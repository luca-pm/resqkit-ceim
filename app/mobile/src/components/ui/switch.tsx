import React from 'react';
import { Switch as RNSwitch, SwitchProps } from 'react-native';

/**
 * Thin wrapper so call sites read the same as web's shadcn Switch. RN's
 * Switch takes native color props (not NativeWind classes) for its track/
 * thumb, so those are resolved here once rather than at each call site.
 */
export const Switch: React.FC<SwitchProps> = (props) => (
  <RNSwitch
    trackColor={{ false: '#cbd5da', true: 'hsl(202 74% 42%)' }}
    thumbColor="#ffffff"
    {...props}
  />
);
