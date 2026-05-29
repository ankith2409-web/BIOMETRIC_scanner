import React from 'react';
import Svg, { Path, Rect, Circle, G, Line } from 'react-native-svg';
import { Colors } from '../../constants/theme';

export type ArchitectureType =
  | 'taj-mahal'
  | 'gateway-of-india'
  | 'temple-gopuram'
  | 'stone-chariot'
  | 'charminar'
  | 'howrah-bridge'
  | 'statue-of-unity'
  | 'houseboat'
  | 'golden-temple';

interface ArchitectureIconProps {
  name: ArchitectureType;
  color?: string;
  size?: number;
}

export default function ArchitectureIcon({
  name,
  color = Colors.accent,
  size = 32,
}: ArchitectureIconProps) {
  // We use a base viewBox of 0 0 64 64 to keep drawings sharp and scalable.
  const strokeWidth = 1.5;

  const renderIconContent = () => {
    switch (name) {
      case 'taj-mahal':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Base platform */}
            <Line x1="4" y1="52" x2="60" y2="52" />
            <Rect x="16" y="36" width="32" height="16" rx="1" />
            {/* Center Main Arch */}
            <Path d="M26,52 L26,44 Q32,40 38,44 L38,52" />
            {/* Side Small Arches */}
            <Path d="M19,52 L19,48 Q21,46 23,48 L23,52" />
            <Path d="M41,52 L41,48 Q43,46 45,48 L45,52" />
            {/* Main Central Dome */}
            <Path d="M24,36 Q24,22 32,18 Q40,22 40,36 Z" fill={color + '15'} />
            <Line x1="32" y1="18" x2="32" y2="12" /> {/* Dome Finial */}
            {/* Side Domes */}
            <Path d="M18,36 Q18,28 21,26 Q24,28 24,36 Z" />
            <Path d="M40,36 Q40,28 43,26 Q46,28 46,36 Z" />
            {/* Left Minaret */}
            <Line x1="10" y1="52" x2="10" y2="20" />
            <Rect x="8" y="16" width="4" height="4" rx="0.5" />
            <Line x1="10" y1="16" x2="10" y2="13" />
            {/* Right Minaret */}
            <Line x1="54" y1="52" x2="54" y2="20" />
            <Rect x="52" y="16" width="4" height="4" rx="0.5" />
            <Line x1="54" y1="16" x2="54" y2="13" />
          </G>
        );

      case 'gateway-of-india':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Ground base */}
            <Line x1="4" y1="50" x2="60" y2="50" />
            {/* Lower Plinth */}
            <Rect x="10" y="44" width="44" height="6" />
            {/* Main structure block */}
            <Rect x="12" y="24" width="40" height="20" />
            {/* Central Arch */}
            <Path d="M24,44 L24,32 Q32,26 40,32 L40,44" fill={color + '15'} />
            {/* Left Side Arch */}
            <Path d="M15,44 L15,36 Q18,33 21,36 L21,44" />
            {/* Right Side Arch */}
            <Path d="M43,44 L43,36 Q46,33 49,36 L49,44" />
            {/* Decorative Top Roof Cornice */}
            <Path d="M10,24 L54,24 L50,18 L14,18 Z" />
            {/* Top corner domes / turrets */}
            <Rect x="13" y="14" width="4" height="4" rx="1" />
            <Rect x="47" y="14" width="4" height="4" rx="1" />
            <Rect x="29" y="14" width="6" height="4" rx="1" />
          </G>
        );

      case 'temple-gopuram':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Plinth */}
            <Line x1="6" y1="54" x2="58" y2="54" />
            {/* Entrance Door */}
            <Rect x="12" y="42" width="40" height="12" />
            <Path d="M26,54 L26,47 Q32,44 38,47 L38,54" fill={color + '15'} />
            {/* Tier 1 */}
            <Path d="M16,42 L48,42 L44,32 L20,32 Z" />
            <Line x1="24" y1="32" x2="24" y2="42" />
            <Line x1="32" y1="32" x2="32" y2="42" />
            <Line x1="40" y1="32" x2="40" y2="42" />
            {/* Tier 2 */}
            <Path d="M20,32 L44,32 L40,24 L24,24 Z" />
            <Line x1="28" y1="24" x2="28" y2="32" />
            <Line x1="36" y1="24" x2="36" y2="32" />
            {/* Tier 3 */}
            <Path d="M24,24 L40,24 L36,16 L28,16 Z" />
            <Line x1="32" y1="16" x2="32" y2="24" />
            {/* Peak Dome (Kalash) */}
            <Path d="M29,16 Q29,10 32,8 Q35,10 35,16 Z" fill={color + '20'} />
            <Circle cx="32" cy="7" r="1" fill={color} />
          </G>
        );

      case 'stone-chariot':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Ground */}
            <Line x1="4" y1="52" x2="60" y2="52" />
            {/* Chariot Body base */}
            <Rect x="14" y="32" width="36" height="12" rx="1" />
            {/* Wheels */}
            <Circle cx="22" cy="46" r="6" fill={color + '10'} />
            <Circle cx="22" cy="46" r="1.5" fill={color} />
            <Circle cx="42" cy="46" r="6" fill={color + '10'} />
            <Circle cx="42" cy="46" r="1.5" fill={color} />
            {/* Wheel Spokes */}
            <Line x1="22" y1="40" x2="22" y2="52" />
            <Line x1="16" y1="46" x2="28" y2="46" />
            <Line x1="42" y1="40" x2="42" y2="52" />
            <Line x1="36" y1="46" x2="48" y2="46" />
            {/* Elephant Trunk / front lead */}
            <Path d="M14,40 C10,40 8,36 8,32" />
            {/* Upper Shrine / Gopuram */}
            <Path d="M20,32 L44,32 L40,20 L24,20 Z" />
            <Path d="M24,20 Q24,14 32,12 Q40,14 40,20 Z" fill={color + '15'} />
            {/* Pillars */}
            <Line x1="26" y1="20" x2="26" y2="32" />
            <Line x1="38" y1="20" x2="38" y2="32" />
          </G>
        );

      case 'charminar':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Base platform */}
            <Line x1="6" y1="52" x2="58" y2="52" />
            {/* Central Structure */}
            <Rect x="18" y="28" width="28" height="24" rx="1" />
            {/* Main Archways */}
            <Path d="M24,52 L24,38 Q32,32 40,38 L40,52" fill={color + '15'} />
            {/* Left Minaret */}
            <Rect x="12" y="16" width="6" height="36" />
            <Path d="M12,16 L18,16 L18,10 L12,10 Z" fill={color + '20'} />
            <Path d="M11,10 Q11,6 15,4 Q19,6 19,10 Z" />
            {/* Right Minaret */}
            <Rect x="46" y="16" width="6" height="36" />
            <Path d="M46,16 L52,16 L52,10 L46,10 Z" fill={color + '20'} />
            <Path d="M45,10 Q45,6 49,4 Q53,6 53,10 Z" />
            {/* Balcony / Center Windows */}
            <Line x1="18" y1="28" x2="46" y2="28" />
            <Line x1="18" y1="32" x2="46" y2="32" />
            <Circle cx="32" cy="22" r="2" />
          </G>
        );

      case 'howrah-bridge':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* River water lines */}
            <Path d="M4,52 Q18,50 32,52 Q46,54 60,52" />
            <Path d="M8,55 Q24,53 40,55 Q56,57 60,55" opacity={0.5} />
            {/* Bridge Deck / Roadway */}
            <Line x1="4" y1="42" x2="60" y2="42" />
            {/* Main Left Pillar Tower */}
            <Path d="M14,42 L16,14 L22,14 L24,42 Z" fill={color + '10'} />
            {/* Main Right Pillar Tower */}
            <Path d="M40,42 L42,14 L48,14 L50,42 Z" fill={color + '10'} />
            {/* Connecting Top Arch Truss */}
            <Path d="M4,42 Q19,16 32,16 Q45,16 60,42" />
            <Path d="M18,14 Q32,24 44,14" />
            {/* Suspension / Truss support lines */}
            <Line x1="19" y1="14" x2="19" y2="42" />
            <Line x1="28" y1="20" x2="28" y2="42" />
            <Line x1="36" y1="20" x2="36" y2="42" />
            <Line x1="45" y1="14" x2="45" y2="42" />
            <Line x1="10" y1="34" x2="15" y2="42" />
            <Line x1="54" y1="34" x2="49" y2="42" />
          </G>
        );

      case 'statue-of-unity':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Ground base */}
            <Line x1="6" y1="54" x2="58" y2="54" />
            {/* Pedestal block */}
            <Path d="M22,54 L26,38 L38,38 L42,54 Z" fill={color + '15'} />
            <Line x1="28" y1="46" x2="36" y2="46" />
            {/* Standing figure outline */}
            {/* Legs */}
            <Line x1="30" y1="38" x2="30" y2="26" />
            <Line x1="34" y1="38" x2="34" y2="26" />
            {/* Torso & Robe */}
            <Path d="M27,26 L37,26 L36,14 L28,14 Z" fill={color + '20'} />
            {/* Folded Hands / Shawl lines */}
            <Path d="M26,16 C29,18 35,18 38,16" />
            {/* Head */}
            <Circle cx="32" cy="10" r="3.5" fill={color + '20'} />
            {/* Staff / Flag background element for high-tech HUD look */}
            <Line x1="25" y1="38" x2="25" y2="8" opacity={0.4} />
          </G>
        );

      case 'houseboat':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Water lines */}
            <Path d="M4,48 Q18,46 32,48 Q46,50 60,48" />
            <Path d="M8,52 Q24,50 40,52 Q56,54 58,52" opacity={0.5} />
            {/* Boat Hull */}
            <Path d="M10,38 L54,38 C52,43 46,46 32,46 C18,46 12,43 10,38 Z" fill={color + '20'} />
            {/* Canopy / Thatched Roof */}
            <Path d="M14,38 Q18,22 32,22 Q46,22 50,38 Z" fill={color + '15'} />
            {/* Roof textures (ribs) */}
            <Path d="M20,38 Q22,25 32,25 Q42,25 44,38" opacity={0.6} />
            <Path d="M26,38 Q27,28 32,28 Q37,28 38,38" opacity={0.6} />
            {/* Cabin details / Windows */}
            <Rect x="22" y="32" width="6" height="6" rx="1" />
            <Rect x="36" y="32" width="6" height="6" rx="1" />
            {/* Front rudder pole */}
            <Line x1="8" y1="38" x2="4" y2="34" />
          </G>
        );

      case 'golden-temple':
        return (
          <G stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Water ripples */}
            <Path d="M4,50 Q32,48 60,50" />
            <Path d="M8,53 Q32,51 56,53" opacity={0.5} />
            {/* Causey pathway */}
            <Line x1="6" y1="50" x2="16" y2="40" opacity={0.6} />
            {/* Main Temple Structure Base */}
            <Rect x="16" y="32" width="32" height="16" rx="1" />
            {/* Arched Entrance */}
            <Path d="M28,48 L28,40 Q32,37 36,40 L36,48" fill={color + '20'} />
            {/* Upper Story */}
            <Rect x="20" y="22" width="24" height="10" rx="0.5" />
            {/* Small Side Domes */}
            <Path d="M17,22 Q17,18 19,17 Q21,18 21,22 Z" />
            <Path d="M43,22 Q43,18 45,17 Q47,18 47,22 Z" />
            {/* Main Central Golden Dome */}
            <Path d="M26,22 Q26,12 32,10 Q38,12 38,22 Z" fill={color + '30'} />
            <Line x1="32" y1="10" x2="32" y2="6" />
          </G>
        );

      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {renderIconContent()}
    </Svg>
  );
}
