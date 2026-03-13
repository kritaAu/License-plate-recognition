const AuthService = {
  setToken: (token) => localStorage.setItem("auth_token", token),
  getToken: () => localStorage.getItem("auth_token"),
  removeToken: () => localStorage.removeItem("auth_token"),
  setUser: (user) => localStorage.setItem("user", JSON.stringify(user)),
  getUser: () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },
  removeUser: () => localStorage.removeItem("user"),
  isAuthenticated: () => !!localStorage.getItem("auth_token"),
  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
  },
};
export default AuthService;
