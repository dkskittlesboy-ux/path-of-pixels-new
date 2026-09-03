# BrowserQuest Websim Port

This project is a Websim-native port of **BrowserQuest**, the HTML5 multiplayer action RPG experiment originally created for Mozilla by [Little Workshop](http://www.littleworkshop.fr/).

## Original creators

- Franck Lecollinet ([@whatthefranck](https://twitter.com/whatthefranck))
- Guillaume Lecollinet ([@glecollinet](https://twitter.com/glecollinet))
- Mozilla and the original BrowserQuest contributors

## Source used for this port

The map data, pixel art, sprite metadata, fonts, and audio in this project come from the [Copephobia/BrowserQuest](https://github.com/Copephobia/BrowserQuest) repository, itself an updated fork of Mozilla's BrowserQuest.

The obsolete Node.js/Socket.IO backend and RequireJS client were not copied wholesale. They were replaced with a static ES-module client and Websim multiplayer synchronization for Websim user identity, player presence, chat, combat state, drops, and chests.

## Licenses

- BrowserQuest code is licensed under the [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/).
- BrowserQuest content is licensed under [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- The source repository's original license notice is preserved in `THIRD_PARTY_LICENSES.txt`.

This port retains the BrowserQuest name solely to identify the open-source game being adapted. It is not an official Mozilla release.
