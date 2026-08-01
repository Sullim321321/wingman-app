// sharedmode.js — the active theme mode, readable synchronously by non-hook modules.
//
// components.js builds its shared styles once at load and is imported by ~43 screens as
// static `g.*`, so it can't use the useTheme() hook. This leaf module lets it follow the
// live theme anyway: ThemeContext writes the current mode here whenever it changes, and
// components.js reads it (via a proxy) at render time to pick the dark or light stylesheet.
// A plain module global — no React, no cycle (both sides import only this).
let _dark = true; // dark-primary default until ThemeContext reports otherwise
export const setSharedDark = (v) => { _dark = !!v; };
export const sharedIsDark = () => _dark;
