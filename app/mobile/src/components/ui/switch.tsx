import React from 'react';
import { Switch as RNSwitch, SwitchProps } from 'react-native';

import { useTokenColors } from '@/lib/tokenColors';

/**
 * Thin wrapper so call sites read the same as web's shadcn Switch. RN's
 * Switch takes native color props (not NativeWind classes) for its track/
 * thumb, so those are resolved here once rather than at each call site —
 * via useTokenColors(), so a palette change (e.g. the primary re-brand)
 * propagates here automatically instead of leaving a stale literal.
 */
export const Switch: React.FC<SwitchProps> = (props) => {
  const colors = useTokenColors();
  return (
    <RNSwitch
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor="#ffffff"
      {...props}
    />
  );
};
