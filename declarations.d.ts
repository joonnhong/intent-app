declare module 'expo-av' {
  export const Audio: any;
}

declare module '*.mp3' {
  const asset: number;
  export default asset;
}
