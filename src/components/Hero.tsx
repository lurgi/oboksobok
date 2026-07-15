import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <h1 className={styles.heading}>
        사소한 시간에
        <br className={styles.mobileBreak} /> 소복이 쌓이는 이야기
      </h1>
      <p className={styles.description}>
        오복소복은 쉴 때 우리가 하는 일을 담습니다.
        <br />
        사소하고 평범한 행위들 속에서 쉼의 가치를 발견하고
        <br />
        의미 있는 순간을 쌓아가는 공간입니다.
      </p>
    </section>
  );
}
