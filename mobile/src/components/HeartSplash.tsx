import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface HeartSplashProps {
  onFinish: () => void;
  durationMs?: number;
}

export const HeartSplash: React.FC<HeartSplashProps> = ({
  onFinish,
  durationMs = 2200,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(14)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // 1. Entrance animation: fade in and expand heart
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacityAnim, {
        toValue: 1,
        duration: 500,
        delay: 250,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. Heartbeat pulse loop
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 380,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.98,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.04,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.current.start();
    });

    // 3. Auto-finish timer
    const timer = setTimeout(() => {
      handleFinish();
    }, durationMs);

    return () => {
      clearTimeout(timer);
      pulseLoopRef.current?.stop();
    };
  }, []);

  const handleFinish = () => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
    }).start(() => {
      onFinish();
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handleFinish}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7FC" translucent={false} />

      <LinearGradient
        colors={['#FFF5F8', '#F5EBFB', '#EAF2FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient background soft blobs */}
      <View style={styles.ambientBlobPink} />
      <View style={styles.ambientBlobBlue} />

      <Animated.View
        style={[
          styles.contentWrap,
          {
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Heart Logo with pulse */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/heart-logo.png')}
            style={styles.heartImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacityAnim,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>PregnaCare</Text>
          <Text style={styles.brandTagline}>Maternal Health & Risk Monitoring</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientBlobPink: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
    backgroundColor: 'rgba(255, 175, 204, 0.35)',
  },
  ambientBlobBlue: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: (width * 0.75) / 2,
    backgroundColor: 'rgba(162, 210, 255, 0.35)',
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 140,
    height: 140,
    shadowColor: '#C2577D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
    marginBottom: 26,
    borderRadius: 36,
  },
  heartImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  textContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: 'serif',
    fontSize: 34,
    fontWeight: '800',
    color: '#9C335C',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  brandTagline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B5868',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 24,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C2577D',
    opacity: 0.6,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.8 },
  dot3: { opacity: 1.0 },
});
