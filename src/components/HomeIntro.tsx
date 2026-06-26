import styles from "./HomeIntro.module.css";

export function HomeIntro() {
  return (
    <section className={styles.root}>
      <div className={styles.pixelArt} aria-hidden="true">
        <span className={styles.pixel} />
      </div>
      <p>준비중입니다</p>
    </section>
  );
}
