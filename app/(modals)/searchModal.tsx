import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useState } from "react";
import ModalWrapper from "@/components/ModalWrapper";
import { colors, spacingX, spacingY } from "@/constants/theme";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { Image } from "expo-image";
import { getProfileImage } from "@/services/imageService";
import { scale, verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import Typo from "@/components/Typo";
import Input from "@/components/Input";
import { TransactionType, UserDataType, WalletType } from "@/types";
import Button from "@/components/Button";
import { useAuth } from "@/Context/authContext";
import { updateUser } from "@/services/userService";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import ImageUpload from "@/components/ImageUpload";
import { createOrUpdateWallet, deleteWallet } from "@/services/walletService";
import { limit, orderBy, where } from "firebase/firestore";
import useFetchData from "@/hooks/useFetchData";
import TransactionList from "@/components/TransactionList";

const SearchModal = () => {
  const { user, updateUserData } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const constraints = [where("uid", "==", user?.uid), orderBy("date", "desc")];

  const {
    data: allTransactions,
    error,
    loading: transactionLoading,
  } = useFetchData<TransactionType>("transactions", constraints);

  const filteredTransactions = allTransactions.filter((item) => {
    if (search.length > 1) {
      if (
        item.category?.toLowerCase()?.includes(search?.toLocaleLowerCase()) ||
        item.type?.toLowerCase()?.includes(search?.toLocaleLowerCase()) ||
        item.description?.toLowerCase()?.includes(search?.toLocaleLowerCase())
      ) {
        return true;
      }
      return false;
    }
    return true;
  });

  return (
    <ModalWrapper style={{ backgroundColor: colors.neutral900 }}>
      <View style={styles.container}>
        <Header
          title={"Search"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        {/* form */}
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.inputContainer}>
            <Input
              placeholder="shoes..."
              placeholderTextColor={colors.neutral400}
              value={search}
              containerStyle={{ backgroundColor: colors.neutral800 }}
              onChangeText={(value) => setSearch(value)}
            />
          </View>

          <View>
            <TransactionList
              loading={transactionLoading}
              data={filteredTransactions}
              emptyListMessage="No transactions match your keywords"
            />
          </View>
        </ScrollView>
      </View>
    </ModalWrapper>
  );
};

export default SearchModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacingY._20,
  },
  form: {
    gap: spacingY._30,
    marginTop: spacingY._15,
  },
  inputContainer: {
    gap: spacingY._10,
  },
});
