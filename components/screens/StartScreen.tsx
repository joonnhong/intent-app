import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_HORIZONTAL_PADDING, colors, typography } from '../../constants/theme';
import { AnchorLogo } from '../brand/AnchorLogo';
import { CeramicButton } from '../intent/CeramicButton';

type StartScreenProps = {
  onStartFocusing: () => void;
};

export function StartScreen({ onStartFocusing }: StartScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <AnchorLogo width={252} subtitle="Hold your focus." />
        </View>

        <View style={styles.actions}>
          <CeramicButton label="Start focusing" size="largeCompact" onPress={onStartFocusing} />
          <Text style={styles.footer}>Portfolio prototype. No account required.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingVertical: 28,
    gap: 34,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  actions: {
    gap: 12,
  },
  footer: {
    ...typography.meta,
    marginTop: 4,
    textAlign: 'center',
    color: colors.faint,
  },
});
