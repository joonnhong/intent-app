import { Animated, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type HardwareLedSize = 'xs' | 'small' | 'medium' | 'large';
type HardwareLedTone = 'orange' | 'sage';

type HardwareLedProps = {
  isOn?: boolean;
  size?: HardwareLedSize;
  tone?: HardwareLedTone;
  pulseOpacity?: Animated.Value;
};

const ledSizes = {
  xs: 12,
  small: 20,
  medium: 28,
  large: 44,
} as const;

export function HardwareLed({ isOn = true, size = 'small', tone = 'orange', pulseOpacity }: HardwareLedProps) {
  const ledSize = ledSizes[size];
  const toneColor = tone === 'sage' ? colors.sage : colors.orange;
  const animOpacity = pulseOpacity as unknown as number;

  const emitR = isOn ? 5.6 : 4.5;

  return (
    <View pointerEvents="none" style={{ width: ledSize, height: ledSize }}>
      <Svg width={ledSize} height={ledSize} viewBox="0 0 44 44">
        <Defs>
          <RadialGradient id="sLedCorona" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={toneColor} stopOpacity={isOn ? '0.36' : '0'} />
            <Stop offset="38%"  stopColor={toneColor} stopOpacity={isOn ? '0.14' : '0'} />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="sLedInnerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={toneColor} stopOpacity={isOn ? '0.72' : '0'} />
            <Stop offset="55%"  stopColor={toneColor} stopOpacity={isOn ? '0.38' : '0'} />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="sLedRim" cx="42%" cy="38%" r="60%">
            <Stop offset="0%"   stopColor="#504D48" stopOpacity="1" />
            <Stop offset="55%"  stopColor="#2B2825" stopOpacity={isOn ? '0.55' : '1'} />
            <Stop offset="100%" stopColor="#131210" stopOpacity={isOn ? '0.08' : '1'} />
          </RadialGradient>
          <RadialGradient id="sLedDot" cx="34%" cy="30%" r="66%">
            <Stop offset="0%"   stopColor="#A09890" stopOpacity="1" />
            <Stop offset="42%"  stopColor="#4A4540" stopOpacity="1" />
            <Stop offset="100%" stopColor="#1A1714" stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="sLedEmit" cx="48%" cy="46%" r="58%">
            <Stop offset="0%"   stopColor="#FFFFFF"  stopOpacity={isOn ? '0.28' : '0'} />
            <Stop offset="30%"  stopColor="#FFFFFF"  stopOpacity={isOn ? '0.08' : '0'} />
            <Stop offset="65%"  stopColor={toneColor} stopOpacity={isOn ? '1'    : '0'} />
            <Stop offset="100%" stopColor={toneColor} stopOpacity={isOn ? '0.90' : '0'} />
          </RadialGradient>
        </Defs>

        {pulseOpacity ? (
          <>
            <AnimatedCircle cx="22" cy="22" r="21"  fill="url(#sLedCorona)"    stroke="none" opacity={animOpacity} />
            <AnimatedCircle cx="22" cy="22" r="9"   fill="url(#sLedInnerGlow)" stroke="none" opacity={animOpacity} />
            <Circle         cx="22" cy="22" r="5.8" fill="url(#sLedRim)"       stroke="none" />
            {/* Solid dome fill blocks dark rim from bleeding through semi-transparent emit */}
            <Circle         cx="22" cy="22" r="5.6" fill={toneColor}           stroke="none" />
            <AnimatedCircle cx="22" cy="22" r={5.6} fill="url(#sLedEmit)"      stroke="none" opacity={animOpacity} />
            <Circle         cx="21.0" cy="20.2" r="1.1" fill="#FFFFFF"         stroke="none" opacity="0.82" />
          </>
        ) : (
          <>
            <Circle cx="22" cy="22" r="21"      fill="url(#sLedCorona)"    stroke="none" />
            <Circle cx="22" cy="22" r="9"       fill="url(#sLedInnerGlow)" stroke="none" />
            <Circle cx="22" cy="22" r="5.8"     fill="url(#sLedRim)"       stroke="none" />
            {isOn
              ? <Circle cx="22" cy="22" r="5.6" fill={toneColor}           stroke="none" />
              : <Circle cx="22" cy="22" r="4.5" fill="url(#sLedDot)"       stroke="none" />
            }
            <Circle cx="22" cy="22" r={emitR}   fill="url(#sLedEmit)"      stroke="none" />
            <Circle cx="21.0" cy="20.2" r="1.1" fill="#FFFFFF"             stroke="none" opacity={isOn ? '0.82' : '0.28'} />
          </>
        )}
      </Svg>
    </View>
  );
}
