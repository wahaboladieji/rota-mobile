import React from 'react';
import { View } from 'react-native';

export const ArrowLeftIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.7, height: 2, backgroundColor: color }} />
    <View
      style={{
        position: 'absolute',
        left: 2,
        width: size * 0.4,
        height: size * 0.4,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderColor: color,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  </View>
);

export const ChevronRightIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.35,
        height: size * 0.35,
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  </View>
);

export const ChevronDownIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.4,
        height: size * 0.4,
        borderBottomWidth: 2,
        borderRightWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginTop: -size * 0.15,
      }}
    />
  </View>
);

export const PlusIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.75, height: 2, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ position: 'absolute', width: 2, height: size * 0.75, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

export const HouseIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.4,
        borderRightWidth: size * 0.4,
        borderBottomWidth: size * 0.35,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
    <View
      style={{
        width: size * 0.6,
        height: size * 0.4,
        borderWidth: 1.8,
        borderTopWidth: 0,
        borderColor: color,
      }}
    />
  </View>
);

export const CalendarDaysIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.75,
        height: size * 0.7,
        borderWidth: 1.8,
        borderColor: color,
        borderRadius: 4,
        paddingTop: 3,
      }}
    >
      <View style={{ width: '100%', height: 1.5, backgroundColor: color }} />
    </View>
  </View>
);

export const Repeat2Icon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.7, height: 2, backgroundColor: color, marginBottom: 4 }} />
    <View style={{ width: size * 0.7, height: 2, backgroundColor: color }} />
  </View>
);

export const ActivityNavIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
    <View style={{ width: 2, height: size * 0.35, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ width: 2, height: size * 0.7, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ width: 2, height: size * 0.45, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

export const EllipsisIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
    <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: color }} />
    <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: color }} />
    <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: color }} />
  </View>
);

export const BellIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.6,
        height: size * 0.6,
        borderWidth: 2,
        borderColor: color,
        borderTopLeftRadius: size * 0.3,
        borderTopRightRadius: size * 0.3,
      }}
    />
    <View style={{ width: size * 0.8, height: 2, backgroundColor: color, marginTop: -1 }} />
  </View>
);

export const SunMoonIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.6,
        height: size * 0.6,
        borderRadius: size * 0.3,
        borderWidth: 2,
        borderColor: color,
      }}
    />
  </View>
);

export const MoonIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.6,
        height: size * 0.6,
        borderRadius: size * 0.3,
        borderWidth: 2,
        borderLeftWidth: 0,
        borderColor: color,
      }}
    />
  </View>
);

export const LanguagesIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.7,
        height: size * 0.6,
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: 3,
      }}
    />
  </View>
);

export const InfoIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1.5,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <View style={{ width: 2, height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 2 }} />
    <View style={{ width: 2, height: 5, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

export const CheckIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.6,
        height: size * 0.35,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
        borderColor: color,
        transform: [{ rotate: '-45deg' }],
        marginTop: -size * 0.1,
      }}
    />
  </View>
);

export const ArrowUpRightIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.5,
        height: size * 0.5,
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        width: size * 0.7,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  </View>
);

export const UsersIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.36,
        height: size * 0.36,
        borderRadius: size * 0.18,
        borderWidth: 1.6,
        borderColor: color,
      }}
    />
    <View
      style={{
        width: size * 0.7,
        height: size * 0.35,
        borderTopLeftRadius: size * 0.25,
        borderTopRightRadius: size * 0.25,
        borderWidth: 1.6,
        borderBottomWidth: 0,
        borderColor: color,
        marginTop: 1,
      }}
    />
  </View>
);

export const UserRoundIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.44,
        height: size * 0.44,
        borderRadius: size * 0.22,
        borderWidth: 1.6,
        borderColor: color,
      }}
    />
    <View
      style={{
        width: size * 0.72,
        height: size * 0.36,
        borderTopLeftRadius: size * 0.26,
        borderTopRightRadius: size * 0.26,
        borderWidth: 1.6,
        borderBottomWidth: 0,
        borderColor: color,
        marginTop: 1,
      }}
    />
  </View>
);

export const WifiOffIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.7,
        height: size * 0.7,
        borderTopWidth: 2,
        borderColor: color,
        borderTopLeftRadius: size * 0.4,
        borderTopRightRadius: size * 0.4,
      }}
    />
    <View
      style={{
        position: 'absolute',
        width: size * 0.9,
        height: 1.6,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
    <View
      style={{
        position: 'absolute',
        bottom: 2,
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: color,
      }}
    />
  </View>
);

export const AlertTriangleIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.45,
        borderRightWidth: size * 0.45,
        borderBottomWidth: size * 0.75,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        bottom: size * 0.2,
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#FFFFFF',
      }}
    />
    <View
      style={{
        position: 'absolute',
        top: size * 0.3,
        width: 1.8,
        height: size * 0.25,
        backgroundColor: '#FFFFFF',
        borderRadius: 1,
      }}
    />
  </View>
);

export const XIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        position: 'absolute',
        width: size * 0.75,
        height: 2,
        backgroundColor: color,
        borderRadius: 1,
        transform: [{ rotate: '45deg' }],
      }}
    />
    <View
      style={{
        position: 'absolute',
        width: size * 0.75,
        height: 2,
        backgroundColor: color,
        borderRadius: 1,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  </View>
);



