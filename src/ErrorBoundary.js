import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.icon}>✈</Text>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.sub}>
            {this.state.error ? this.state.error.message : "An unexpected error occurred."}
          </Text>
          <TouchableOpacity
            style={s.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={s.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0E1C",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  sub: { color: "#8A8FA8", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  btn: {
    backgroundColor: "#4F8EF7",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
