import { GITHUB_URL } from '../config'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <a href={GITHUB_URL}>Source</a>
      {' · '}
      <a href="THIRD-PARTY-NOTICES.txt">Credits</a>
    </footer>
  )
}
