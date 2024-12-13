import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudiary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken; //user mai refresh token dal rahe hai db mai
    await user.save({ validateBeforeSave: false }); //save kr rahe hai /validateBeforeSave use kiye hai kyuki mongoose ka sab function kickin ho jate hai to wo pass required bhi mang lega pr ham ne yaha diya nhi hai to validateBeforeSave :false use kiye hai
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating refresh and acess token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //steps for new user registeration
  //1. get user details from frontend
  //2. validation - nor empty
  //3. check if user already exists:username, email
  //4. check for images, check for avatar
  //5. upload them to cloudinary, avatar
  //6. create user object- create entry in db
  //7. remove password and refreshToken:undefine token field form response
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
  //7. remove password and refreshToken:undefine token field form response
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

const loginUser = asyncHandler(async (req, res) => {
  //steps for login
  //1.req body -> data
  //2.username or email
  //3.find the user
  //4.password check
  //5.access and refresh token
  //6.send cookie

  //1. req ->body
  const { email, username, password } = req.body;
  // console.log(email);
  // console.log(password);

  //2.username or email
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }
  //3.find the user

  const user = await User.findOne({
    //findOne e sab mongoDB k mogoose k through available hai to User(capital U) mai use hoga na ki user(small u) mai
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "user does ot exist");
  }
  //4.password check
  const isPasswordValid = await user.isPasswordCorrect(password); //req.body wala password\

  if (!isPasswordValid) {
    throw new ApiError(401, "invalid user credentials");
  }
  //5.access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  //6. send cookie

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken; // this is for mobile access

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized requiest");
  }

  try {
    const decodeToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodeToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "incalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password change successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "current user fetched successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "all feilds are required");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullName, email } },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "aacount details updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "cover image file is missing");
  }
  const coverImage = await uploadOnCloudiary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "error while uploading on cover image");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: coverImage.url,
      },
    },
    { new: true }.select("-password")
  );
  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image update successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar file is missing");
  }
  const avatar = await uploadOnCloudiary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "error while uploading on avatar");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }.select("-password")
  );
  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image update successfully"));
});

cons;
export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
