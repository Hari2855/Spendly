import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { CustomButtonProps } from "@/types";
import Loading from "./loading";
import { colors, radius } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";

const Button = ({
  style,
  onPress,
  loading = false,
  children,
}: CustomButtonProps) => {
  if (loading) {
    return (
      <View style={[styles.button, style, { backgroundColor: "transparent" }]}>
        <Loading />
      </View>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, style]}>
      {children}
    </TouchableOpacity>
  );
};

export default Button;

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    height: verticalScale(52),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius._17,
    borderCurve: "continuous",
  },
});
