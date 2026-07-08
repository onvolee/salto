# Isolate content UI with Shadow DOM

Salto content-script UI will render React surfaces such as the floating trigger, translation panel, and saved-word hover cards inside a Shadow DOM container. This keeps extension-owned UI styling separate from host pages while still allowing saved-word highlights to be applied as ordinary DOM markers in page text. Directly mounting all UI into the page DOM would be simpler, but it makes CSS conflicts and host-page interference part of the core product risk.
