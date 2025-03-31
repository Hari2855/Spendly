import { useRef } from 'react';
import { ResponseType, UserDataType } from "@/types";
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/config/firebase';
import { uploadFileToCloudinary } from './imageService';




export const updateUser = async (
    uid: string,
    updatedData: UserDataType
): Promise<ResponseType> => {
    try {
        if(updatedData.image && updatedData?.image?.uri){
            const imageUploadRes = await uploadFileToCloudinary(
                updatedData.image,
                "users"
            );
            if (!imageUploadRes.success){
                return {
                    success: false,
                    msg: imageUploadRes.msg || "Failed to upload image",
                };
            }
            updatedData.image = imageUploadRes.data;
        }
        const useRef = doc(firestore, "users", uid);
        await updateDoc(useRef, updatedData);

        return { success: true, msg: "updated successfully"};
    } catch (error: any) {
        console.log("error updating user: ", error);
        return { success: false, msg: error?.message};
    }
}