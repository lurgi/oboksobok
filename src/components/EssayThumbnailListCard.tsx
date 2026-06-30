import styles from "./EssayThumbnailListCard.module.css";

export type EssayThumbnailAspectRatio = "1:1" | "3:4" | "4:3";

type EssayThumbnailListCardProps = {
  description: string;
  href?: string;
  imageAlt?: string;
  imageSrc: string;
  imageAspectRatio: EssayThumbnailAspectRatio;
  title: string;
};

const aspectRatioClassNames: Record<EssayThumbnailAspectRatio, string> = {
  "1:1": styles.ratioSquare,
  "3:4": styles.ratioPortrait,
  "4:3": styles.ratioLandscape,
};

export function EssayThumbnailListCard({
  description,
  href,
  imageAlt = "",
  imageAspectRatio,
  imageSrc,
  title,
}: EssayThumbnailListCardProps) {
  const content = (
    <>
      <div className={`${styles.imageFrame} ${aspectRatioClassNames[imageAspectRatio]}`}>
        <img className={styles.image} src={imageSrc} alt={imageAlt} loading="lazy" />
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a className={styles.root} href={href}>
        {content}
      </a>
    );
  }

  return <article className={styles.root}>{content}</article>;
}
