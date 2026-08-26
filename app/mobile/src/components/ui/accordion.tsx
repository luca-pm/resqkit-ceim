/**
 * Minimal single-open-item accordion (Section E6) — RN has no Radix
 * equivalent, so this is a small custom implementation rather than a port.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

interface AccordionItemData {
  key: string;
  trigger: React.ReactNode;
  content: React.ReactNode;
}

export const Accordion: React.FC<{ items: AccordionItemData[] }> = ({ items }) => {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <View>
      {items.map((item, index) => {
        const isOpen = openKey === item.key;
        return (
          <View key={item.key} className={index > 0 ? 'border-t border-border' : ''}>
            <Pressable
              className="flex-row items-center justify-between py-4"
              onPress={() => setOpenKey(isOpen ? null : item.key)}
              accessibilityRole="button"
            >
              <View className="flex-1 pr-3">
                {typeof item.trigger === 'string' ? (
                  <Text className="font-medium text-foreground">{item.trigger}</Text>
                ) : (
                  item.trigger
                )}
              </View>
              <Text className="text-muted-foreground">{isOpen ? '−' : '+'}</Text>
            </Pressable>
            {isOpen && (
              <View className="pb-4">
                {typeof item.content === 'string' ? (
                  <Text className="text-sm text-muted-foreground">{item.content}</Text>
                ) : (
                  item.content
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};
