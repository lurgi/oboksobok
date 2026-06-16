import styles from "./HomeIntro.module.css";

export function HomeIntro() {
  return (
    <section className={styles.root}>
      <p className={styles.eyebrow}>오복소복</p>
      <h1>Notion에서 차곡차곡 가져오는 정적 사이트</h1>
      <p>Astro가 라우팅과 정적 생성을 맡고, React는 UI 컴포넌트와 필요한 island를 담당합니다.</p>
    </section>
  );
}
