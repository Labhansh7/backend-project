import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudiary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";

const registerUser = asyncHandler(async (req, res) => {
  //steps for new user registeration
  //1. get user details from frontend
  //2. validation - nor empty
  //3. check if user already exists:username, email
  //4. check for images, check for avatar
  //5. upload them to cloudinary, avatar
  //6. create user object- create entry in db
  //7. remove password and refreash token field form response
  //8. check for user creation
  //9. return response

  //1. get user details from frontend
  const { fullName, email, username, password } = req.body;
  // console.log("email: ", email);

  //2. validation - not empty(inmported api error)
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "") // aagar koi bhi field trim k baad empty hai to true return karega mtlb wo khali tha (sab ko ek sath check kr rahe hai)
  ) {
    throw new ApiError(400, "all fields are required");
  }

  //3. check if user already exists:username, email (imported user model.js)

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with Email or Username already exists");
  }
  // console.log(req.files);

  // 4. check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;

  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //5. upload them to cloudinary, avatar ( imported  uploadOnCloudiary)

  const avatar = await uploadOnCloudiary(avatarLocalPath);
  const coverImage = await uploadOnCloudiary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  //6. create user object- create entry in db(user file)
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });
  //7. remove password and refreash token field form response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  //8. check for user creation
  if (!createdUser) {
    throw new ApiError(500, "somthing went wrong while registering the user");
  }
  //9. return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user registered successfully"));
});

export { registerUser };
