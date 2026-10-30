// 이미지 파일 import (Vite가 주소로 바꿔 준다)
declare module '*.png' {
  const src: string;
  export default src;
}
