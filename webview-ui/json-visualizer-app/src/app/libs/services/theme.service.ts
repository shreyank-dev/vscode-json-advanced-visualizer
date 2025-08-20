import { Injectable, OnDestroy } from '@angular/core';

// Constants for theme names and IDs
const THEME_LINK_ID = 'app-theme';
const THEME_DARK = 'aura-dark-blue';
const THEME_LIGHT = 'aura-light-blue';

/**
 * A service to dynamically manage the PrimeNG theme based on the active VS Code theme.
 * It listens for changes to the body's class attribute and swaps the theme stylesheet accordingly.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService implements OnDestroy {
  /** The MutationObserver instance watching for theme changes. */
  private observer: MutationObserver | null = null;

  /** A direct reference to the theme's <link> element in the document head. */
  private themeLinkElement: HTMLLinkElement | null = null;

  constructor() {}

  /**
   * Initializes the theme listener. This should be called once when the application starts.
   * It sets the initial theme and then observes for any subsequent changes.
   */
  public initThemeListener() {
    // Watch for changes to the body's class attribute
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          this.updateTheme();
        }
      });
    });

    this.observer.observe(document.body, { attributes: true });

    // Set the initial theme when the listener is initialized
    this.updateTheme();
  }

  /**
   * Checks the body for VS Code's theme classes and updates the theme <link> tag's href.
   */
  private updateTheme() {
    if (!this.themeLinkElement) {
      // Find the link element on the first run.
      this.themeLinkElement = document.getElementById(
        THEME_LINK_ID
      ) as HTMLLinkElement;
      if (!this.themeLinkElement) {
        console.error(
          'Could not find theme link element with ID:',
          THEME_LINK_ID
        );
        return;
      }
    }

    const themeName = this.isDarkTheme() ? THEME_DARK : THEME_LIGHT;
    const newHref = this.themeLinkElement.href.replace(
      /aura-(light|dark)-blue\.css/,
      `${themeName}.css`
    );

    if (this.themeLinkElement.href !== newHref) {
      this.themeLinkElement.href = newHref;
    }
  }

  /**
   * A public utility method to check if the current theme is dark.
   * @returns `true` if the body has the 'vscode-dark' class, otherwise `false`.
   */
  public isDarkTheme(): boolean {
    return document.body.classList.contains('vscode-dark');
  }

  /**
   * Cleans up the observer when the service is destroyed to prevent memory leaks.
   */
  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
