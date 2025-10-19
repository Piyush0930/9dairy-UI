import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ShopScreen from './ShopScreen';
import MyList from './MyList';
import OrderScreen from './OrderScreen';
import AccountScreen from './AccountScreen';

const Tab = createBottomTabNavigator();

export default function CustomerDashboard() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Shop" component={ShopScreen} />
      <Tab.Screen name="MyList" component={MyList} />
      <Tab.Screen name="Orders" component={OrderScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
