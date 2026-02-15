// ZIP bundle extraction using fflate
import { unzipSync } from 'fflate';

// README basenames are injected from translations at build time (window.README_NAMES)
declare global {
  interface Window {
    README_NAMES?: string[];
  }
}

export interface BundleContents {
  share: string; // README.txt content containing the share
  manifest?: Uint8Array; // MANIFEST.age content if present
}

/**
 * Extract share and manifest from a bundle ZIP file.
 * Looks for README*.txt (any language) and MANIFEST.age.
 */
export function extractBundle(zipData: Uint8Array): BundleContents {
  const files = unzipSync(zipData);
  const readmeNames = window.README_NAMES || ['README'];

  let readmeContent: string | undefined;
  let manifestData: Uint8Array | undefined;

  for (const [name, data] of Object.entries(files)) {
    const basename = name.split('/').pop() || name;
    const upperBase = basename.toUpperCase();

    // Check for README.txt in any language (README.txt, LEEME.txt, LIESMICH.txt, etc.)
    for (const readmeName of readmeNames) {
      if (upperBase === `${readmeName.toUpperCase()}.TXT`) {
        readmeContent = new TextDecoder().decode(data);
        break;
      }
    }

    if (upperBase === 'MANIFEST.AGE') {
      manifestData = data;
    }
  }

  if (!readmeContent) {
    const foundFiles = Object.keys(files).join(', ');
    throw new Error(`README file not found in bundle. Found: ${foundFiles}`);
  }

  return {
    share: readmeContent,
    manifest: manifestData,
  };
}
