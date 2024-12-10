import dotev from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotev.config({
  path: "./env",
});

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`server is listning at : ${process.env.PORT}`);
    });
    app.on("error", (error) => {
      console.log("ERROR :", error);
      throw error;
    });
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!!", err);
  });
/* import express from "express";
 const app = express()(async () => {
   try {
     await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
     app.on("error", (error) => {
       console.log("ERROR: ", error);
       throw error;
     });

     app.listen(process.env.PORT, () => {
       console.log(`App is listning on port${process.env.PORT}`);
     });
   } catch (error) {
     console.error("ERROR", error);
     throw error;
   }
 })(); */
