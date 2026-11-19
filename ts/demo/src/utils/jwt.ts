import { jwtDecode } from "jwt-decode";
import axios from "./axios";
import { gravarToken } from "./sessaoLocal";

const isTokenValid = (authToken: string): boolean => {
  try {
    const decoded: { exp?: number } = jwtDecode(authToken);
    if (!decoded.exp) {
      console.error("Token does not contain an expiration time.");
      return false;
    }

    const currentTime = Date.now() / 1000; // Current time in seconds since epoch
    return decoded.exp > currentTime;
  } catch (err) {
    console.error("Failed to decode token:", err);
    return false;
  }
};

const setSession = (authToken?: string | null): void => {
  if (typeof authToken === "string" && authToken.trim() !== "") {
    // Guarda o token (localStorage na web, cofre do SO no desktop) e
    // define o header do axios.
    gravarToken(authToken);
    axios.defaults.headers.common.Authorization = `Bearer ${authToken}`;
  } else {
    // Apaga o token guardado e remove o header do axios.
    gravarToken(null);
    delete axios.defaults.headers.common.Authorization;
  }
};

export { isTokenValid, setSession };
