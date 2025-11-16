// // contexts/NavigationContext.jsx
// import React, { createContext, useContext, useState } from 'react';

// const NavigationContext = createContext();

// export const NavigationProvider = ({ children }) => {
//   const [isLoggedIn, setIsLoggedIn] = useState(false);

//   const login = () => {
//     setIsLoggedIn(true);
//   };

//   const logout = () => {
//     setIsLoggedIn(false);
//   };

//   return (
//     <NavigationContext.Provider value={{ isLoggedIn, login, logout }}>
//       {children}
//     </NavigationContext.Provider>
//   );
// };

// export const useNavigation = () => useContext(NavigationContext);