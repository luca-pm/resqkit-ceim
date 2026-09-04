/**
 * Nav shell (Section E6). Switched from expo-router/unstable-native-tabs to
 * the standard, stable `Tabs` — NativeTabs took raw resolved hex colors as
 * props (backgroundColor/indicatorColor), which is exactly why it had
 * drifted onto the stock Expo template palette instead of the real one and
 * couldn't respond to a dark-mode toggle. Tabs renders in JS and is styled
 * with NativeWind className like everything else, so it stays in sync.
 *
 * Only 4 routes are visible tabs (Acasă, ResQKit AI, Istoric, Cont); the
 * rest (Settings/FAQ/Contact/Tutoriale, sign-in, the RN-build spikes, the
 * stock "explore" demo screen) are real routes reachable via router.push,
 * just hidden from the tab bar via `href: null`.
 */
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, MessageCircle, Clock, UserRound } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

export default function AppTabs() {
  const { t } = useTranslation('common');
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#DCE6EA' : '#10293D';
  const activeColor = colorScheme === 'dark' ? '#4FB3EA' : '#1783BC';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: iconColor,
        tabBarStyle: { backgroundColor: colorScheme === 'dark' ? '#10222E' : '#FFFFFF' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('nav.home'), tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'ResQKit AI',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: t('nav.history'), tabBarIcon: ({ color, size }) => <Clock color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('nav.account'),
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />

      {/* Real routes, hidden from the tab bar — reachable via router.push. */}
      <Tabs.Screen name="consent" options={{ href: null }} />
      <Tabs.Screen name="emergency" options={{ href: null }} />
      <Tabs.Screen name="handoff" options={{ href: null }} />
      <Tabs.Screen name="review" options={{ href: null }} />
      <Tabs.Screen name="incident-detail" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="kits" options={{ href: null }} />
      <Tabs.Screen name="learn" options={{ href: null }} />
      <Tabs.Screen name="regulations" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="sign-in" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="faq" options={{ href: null }} />
      <Tabs.Screen name="contact" options={{ href: null }} />
      <Tabs.Screen name="tutorials" options={{ href: null }} />
      <Tabs.Screen name="spike-kit-scanner" options={{ href: null }} />
      <Tabs.Screen name="spike-metronome" options={{ href: null }} />
    </Tabs>
  );
}
