import { firestore } from "@/config/firebase";
import { ResponseType, TransactionType, WalletType } from "@/types"
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";
import { createOrUpdateWallet } from "./walletService";
import { getLast12Months, getLast7Days, getYearsRange } from "@/utils/common";
import { scale } from "@/utils/styling";
import { colors } from "@/constants/theme";

export const createOrUpdateTransaction = async (
    transactionData: Partial<TransactionType>
 ): Promise<ResponseType> => {
     try {
        const {id, type, walletId, amount, image} = transactionData;
        if(!amount || amount<=0 || !walletId || !type){
            return {success: false, msg: "Invalid transaction data!"};
        }

        if(id){
            const oldTransactionSnapshot = await getDoc(
                doc(firestore, "transactions", id)
            );
            const oldTransaction = oldTransactionSnapshot.data() as TransactionType;
            const shouldRevertOrignal = 
              oldTransaction.type != type ||
              oldTransaction.amount != amount ||
              oldTransaction.walletId != walletId;
              if(shouldRevertOrignal){
                let res = await revertAndUpdateWallets(oldTransaction, Number(amount), type, walletId);
                if(!res.success) return res;
              }
        }else{
            // update wallet for new transaction
            let res = await updateWalletForNewTransaction(
                walletId!,
                Number(amount!),
                type
            );
            if(!res.success) return res;
        }

         if(image){
                    const imageUploadRes = await uploadFileToCloudinary(
                        image,
                        "transactions"
                    );
                    if (!imageUploadRes.success){
                        return {
                            success: false,
                            msg: imageUploadRes.msg || "Failed to upload recipt",
                        };
                    }
                    transactionData.image = imageUploadRes.data;
                }

        const transactionRef = id
        ? doc(firestore, "transactions", id)
        : doc(collection(firestore, "transactions"))

        await setDoc(transactionRef, transactionData, {merge: true});
          return{ success: true, data: {...transactionData, id: transactionRef.id}};
        } catch(err:any){
            console.log('error creating or updating transaction: ', err);
            return {success: false, msg: err.message}
        }
 }

 const updateWalletForNewTransaction = async(
    walletId: string,
    amount: number,
    type: string
 ) => {
    try {
    const walletRef = doc(firestore, "wallets", walletId);
    const walletSnapshot = await getDoc(walletRef);
    if(!walletSnapshot.exists()){
        console.log('error updating wallet for new transaction');
        return { success: false, msg: "Wallet not found"};
    }

    const walletData = walletSnapshot.data() as WalletType;
   
    if(type == "expense" && walletData.amount! - amount < 0) {
        return {
            success: false,
            msg: "Selected wallet don't have enough balance",
        };
    }

    const updateType = type == "income" ? "totalIncome" : "totalExpense";
    const updatedWalletAmount = 
      type == "income"
      ? Number(walletData.amount) + amount
      : Number(walletData.amount) - amount;

    const updatedTotals = type == "income"
    ? Number(walletData.totalIncome) + amount
    : Number(walletData.totalExpense) + amount; 

    await updateDoc(walletRef, {
        amount: updatedWalletAmount,
        [updateType]: updatedTotals,
    })
    return {success: true}
 }catch (err: any) {
    console.log("error updating wallet for new transaction: ", err);
    return { success: false, msg: err.message}
 }
 };

 const revertAndUpdateWallets = async(
    oldTransaction: TransactionType,
    newTransactionAmount: number,
    newTransactionType: string,
    newWalletId: string
 ) => {
    try {
    const orignalWalletSnapshot = await getDoc(doc(firestore, "wallets", oldTransaction.walletId));

    const orignalWallet = orignalWalletSnapshot.data() as WalletType;

    let newWalletSnapshot = await getDoc(doc(firestore, "wallets", newWalletId));

    let newWallet = newWalletSnapshot.data() as WalletType;

    const revertType = oldTransaction.type == "income" ? "totalIncome": "totalExpense"

    const revertedIncomeExpense: number = oldTransaction.type == "income" ? -Number(oldTransaction.amount) : Number(oldTransaction.amount);

    const revertedWalletAmount = Number(orignalWallet.amount) + revertedIncomeExpense;

    const revertedIncomeExpenseAmount = Number(orignalWallet[revertType]) - Number(oldTransaction.amount)

    if(newTransactionType == "expense") {
        // if user tries to convert income to expense on the same wallet
        // or if the user tries to increase the expense amount and don't have enough balance
        if(oldTransaction.walletId == newWalletId && revertedWalletAmount < newTransactionAmount){
            return {
                success: false,
                msg: "The selected wallet don't have enough balance"
            };
        }

        // if user tries to add expense from a new wallet but the wallet don't have enough balance
        if(newWallet.amount! < newTransactionAmount){
            return {
                success: false,
                msg: "The selected wallet don't have enough balance"
            };  
        }
    }

    await createOrUpdateWallet({
        id: oldTransaction.walletId,
        amount: revertedWalletAmount,
        [revertType]: revertedIncomeExpenseAmount,
    })
    // reverted completed
    /////////////////////////////////////////////////////
    
    // refetch the newWallet because we may have just update it
     newWalletSnapshot = await getDoc(doc(firestore, "wallets", newWalletId));
     newWallet = newWalletSnapshot.data() as WalletType;

     const updateType = newTransactionType == "income" ? "totalIncome" : "totalExpense";

     const updatedTransactionAmount: number =
       newTransactionType == "income" ? Number(newTransactionAmount) : -Number(newTransactionAmount);

       const newWalletAmount = Number(newWallet.amount) + updatedTransactionAmount

       const newIncomeExpenseAmount = Number(newWallet[updateType]! + Number(newTransactionAmount))

       await createOrUpdateWallet({
        id: newWalletId,
        amount: newWalletAmount,
        [updateType]: newIncomeExpenseAmount
       });


    return {success: true}
 }catch (err: any) {
    console.log("error updating wallet for new transaction: ", err);
    return { success: false, msg: err.message}
 }
 };

 export const deleteTransaction = async (
    transactionId: string,
    walletId: string
 ) => {
    try {
        const transactionRef =  doc(firestore, "transactions",transactionId)
        const transactionSnapshot = await getDoc(transactionRef);

        if(!transactionSnapshot.exists()){
            return {success: false, msg: "Transaction not found"}
        }
        const transactionData = transactionSnapshot.data() as TransactionType;

        const transactionType = transactionData?.type;
        const transactionAmount = transactionData?.amount;

        // fetch wallet to update amount, totalIncome or totalExpense
        const walletSnapshot = await getDoc(doc(firestore, "wallets", walletId));
        const walletData = walletSnapshot.data() as WalletType;

        // check fields to be updated based on transaction type
        const updateType = transactionType == "income" ? "totalIncome" : "totalExpense";

        const newWalletAmount = walletData?.amount! - (transactionType == "income" ? transactionAmount: -transactionAmount);

        const newIncomeExpenseAmount = walletData[updateType]! - transactionAmount;

        // if its expense and the wallet amount can go below zero
        if(transactionType == "expense" && newWalletAmount < 0){
            return{success: false, msg: "You can not delete this transaction"};
        };

        await createOrUpdateWallet({
            id: walletId,
            amount: newWalletAmount,
            [updateType]: newIncomeExpenseAmount
        });

        await deleteDoc(transactionRef);

     return {success: true}
    }catch (err: any) {
       console.log("error updating wallet for new transaction: ", err);
       return { success: false, msg: err.message}
    }
 }

 export const fetchWeeklyStats = async (uid: string): Promise<ResponseType> => {
    try {
        const db = firestore;
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);

        const transactionQuery = query(
            collection(db, "transactions"),
            where("uid", "==", uid),
            where("date", ">=", Timestamp.fromDate(sevenDaysAgo)),
            where("date", "<=", Timestamp.fromDate(today)),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(transactionQuery);
        const weeklyData = new Map(getLast7Days().map(day => [day.date, day]));
        const transactions: TransactionType[] = [];

        querySnapshot.forEach((doc) => {
            const transaction = doc.data() as TransactionType;
            transaction.id = doc.id;
            transactions.push(transaction);

            const transactionDate = (transaction.date as Timestamp)
                .toDate()
                .toISOString()
                .split("T")[0];

            if (weeklyData.has(transactionDate)) {
                const dayData = weeklyData.get(transactionDate);
                if (transaction.type === "income") {
                    dayData!.income += transaction.amount;
                } else if (transaction.type === "expense") {
                    dayData!.expense += transaction.amount;
                }
            }
        });

        const stats = Array.from(weeklyData.values()).flatMap(day => [
            { value: day.income, label: day.day, spacing: scale(4), labelWidth: scale(30), frontColor: colors.primary },
            { value: day.expense, frontColor: colors.rose }
        ]);

        return { success: true, data: { stats, transactions } };
    } catch (err: any) {
        console.log("Error fetching the weekly stats: ", err);
        return { success: false, msg: err.message };
    }
};

 
 export const fetchMonthlyStats = async (
    uid: string
 ): Promise<ResponseType> => {
    try {
     const db = firestore;
     const today = new Date();
     const twelveMonthAgo = new Date(today);
     twelveMonthAgo.setMonth(today.getMonth() - 12);

     const transactionQuery = query(
        collection(db, "transactions"),
        where("date", ">=", Timestamp.fromDate(twelveMonthAgo)),
        where("date", "<=", Timestamp.fromDate(today)),
        orderBy("date", "desc"),
        where("uid", "==", uid)
     );

     const querySnapshot = await getDocs(transactionQuery);
     const monthlyData = getLast12Months();
     const transactions: TransactionType[] = [];

    //  maping each transaction in a day
    querySnapshot.forEach((doc) => {
        const transaction = doc.data() as TransactionType;
        transaction.id = doc.id;
        transactions.push(transaction);

        const transactionDate = (transaction.date as Timestamp)
         .toDate();
         const monthName = transactionDate.toLocaleString("default",{
            month: "short"
         })
         const shortYear = transactionDate.getFullYear().toString().slice(-2);
         const monthData= monthlyData.find((month) => month.month === `${monthName} ${shortYear}`);

         if(monthData) {
            if(transaction.type == "income"){
                monthData.income += transaction.amount;
            } else if(transaction.type == "expense"){
                monthData.expense += transaction.amount;
            }
         }
    })
 
    const stats = monthlyData.flatMap((month) => [
        {
            value: month.income,
            label: month.month,
            spacing: scale(4),
            labelWidth: scale(46),
            frontColor: colors.primary
        },
        { value: month.expense, frontColor: colors.rose}
    ]);

    return {
        success: true,
        data: {
            stats,
            transactions,
        }
    };
    }catch (err: any) {
       console.log("error fetching monthly stats: ", err);
       return { success: false, msg: "Failed to fetch monthly transactions"}
    }
 }

 export const fetchYearlyStats = async (
    uid: string
 ): Promise<ResponseType> => {
    try {
     const db = firestore;

     const transactionQuery = query(
        collection(db, "transactions"),
        orderBy("date", "desc"),
        where("uid", "==", uid)
     );

     const querySnapshot = await getDocs(transactionQuery);
     const transactions: TransactionType[] = [];

     const firstTransaction = querySnapshot.docs.reduce((earliest, doc)=>{
        const transactionDate = doc.data().date.toDate();
        return transactionDate < earliest ? transactionDate: earliest;
     }, new Date());


     const firstYear = firstTransaction.getFullYear();
     const currentYear = new Date().getFullYear();

     const yearlyData = getYearsRange(firstYear, currentYear);


    querySnapshot.forEach((doc) => {
        const transaction = doc.data() as TransactionType;
        transaction.id = doc.id;
        transactions.push(transaction);

        const transactionYear = (transaction.date as Timestamp)
         .toDate().getFullYear();

         const yearData = yearlyData.find(
            (item:any) => item.year === transactionYear.toString()
         )

         if(yearData) {
            if(transaction.type == "income"){
                yearData.income += transaction.amount;
            } else if(transaction.type == "expense"){
                yearData.expense += transaction.amount;
            }
         }
    })
 
    const stats = yearlyData.flatMap((year:any) => [
        {
            value: year.income,
            label: year.year,
            spacing: scale(4),
            labelWidth: scale(35),
            frontColor: colors.primary
        },
        { value: year.expense, frontColor: colors.rose}
    ]);

    return {
        success: true,
        data: {
            stats,
            transactions,
        }
    };
    }catch (err: any) {
       console.log("error fetching yearly stats: ", err);
       return { success: false, msg: "Failed to fetch yeraly transactions"}
    }
 }