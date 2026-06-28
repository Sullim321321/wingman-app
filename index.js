import { registerRootComponent } from "expo";
import { Alert } from "react-native";
import App from "./App";

// Global JS error handler — surfaces crash details even when ErrorBoundary can't catch them
// (e.g. errors thrown during module evaluation or in async callbacks)
if (global.ErrorUtils) {
  const prevHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      Alert.alert(
        "Fatal Error (Build 64)",
        `${error?.name}: ${error?.message}\n\n${error?.stack?.slice(0, 600)}`,
        [{ text: "OK" }]
      );
    }
    if (prevHandler) prevHandler(error, isFatal);
  });
}

registerRootComponent(App);
