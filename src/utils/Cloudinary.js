import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { loadEnvFile } from "process";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

const uploadOnCloudiary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload the file on cloudiary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    //file has been uploaded sucessfully
    // console.log("file is uploaded on cloudinary");
    // console.log(response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); //remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};

export { uploadOnCloudiary };
