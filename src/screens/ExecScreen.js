import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { C, T } from "../theme";
import { ExecStepper } from "../components";

export default function ExecScreen({ navigation, route }) {
  const { steps, title, doneRoute, doneParams } = route.params;
  return (
    <SafeAreaView style={s.app}>
      <ExecStepper
        steps={steps}
        title={title}
        onDone={() => navigation.replace(doneRoute, doneParams)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({ app: { flex: 1, backgroundColor: C.bg } });
