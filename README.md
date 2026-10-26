# @vdegenne/audio-player

Small helper to load and play audio files in your app with the following features:

- Integrated hash-based audio cache
- Volume control and boosting (values above `1` are supported)
- Optional reverb effects
- Asynchronous playback with cancellation support
- Cancel individual playback or all active playbacks

## Usage

### Initialize the player

Create an `AudioPlayer` with a provider function that returns an audio key and its data. The key is used to cache decoded audio.

```ts
import {AudioPlayer} from '@vdegenne/audio-player'

const player = new AudioPlayer((name: string) => ({
	key: name,
	audio: fetch(name).then((response) => response.blob()),
}))
```

The provider can return either an `AudioRequest` directly or a `Promise<AudioRequest>`. Audio data can be a `Blob`, an `AudioBuffer`, or a promise resolving to either.

### Play audio

```ts
const {playPromise, cancel} = player.play(['bell.mp3'], {
	volume: 1.2, // Values above 1 boost the volume
})

playPromise
	.then(() => {
		console.log('Audio ended')
	})
	.catch((error) => {
		if (error.name === 'AbortError') {
			console.log('Playback canceled')
		} else {
			console.error('Playback failed', error)
		}
	})

cancel() // Cancel this playback at any time
```

`play()` returns an `AudioPlayback` object containing:

- `playPromise`: resolves when playback ends, or rejects if playback is canceled or fails.
- `cancel()`: cancels this playback.

All playback options are optional:

| Option        | Default     | Description                                                                                           |
| ------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `volume`      | `1`         | Playback volume. Values above `1` are supported.                                                      |
| `reverb`      | `undefined` | Reverb preset to apply.                                                                               |
| `reverbLevel` | `0`         | Reverb intensity. Reverb is applied only when a preset is provided and the level is greater than `0`. |

### Cancel all audio at once

Use `cancelAllSpeeches()` to cancel every currently active playback.

```ts
player.cancelAllSpeeches()
```

Each canceled playback's `playPromise` rejects with an `AbortError`.

### Using reverb

First, copy the reverb files into your project's public directory so they can be served by your application.

```bash
cp -r ./node_modules/@vdegenne/audio-player/reverbs/ ./public/.
```

Alternatively, use this JavaScript script:

```js
import {cp} from 'node:fs/promises'

await cp('./node_modules/@vdegenne/audio-player/reverbs', 'public/reverbs', {
	recursive: true,
})
```

Then specify a reverb preset and intensity in the `play()` call:

```ts
const {playPromise} = player.play(['hello.mp3'], {
	reverb: 'Deep Space',
	reverbLevel: 1,
})

await playPromise
```

`reverbLevel` controls the intensity of the effect. Reverb is disabled by default.
