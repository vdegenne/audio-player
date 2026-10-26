import {type ReverbPreset} from './reverb.js'

export interface AudioRequest {
	key: string
	audio: Blob | AudioBuffer | Promise<Blob | AudioBuffer>
}
export interface AudioPlayerOptions {
	reverb?: ReverbPreset
	reverbLevel?: number
	volume?: number
}
export interface AudioPlayback {
	playPromise: Promise<void>
	cancel: () => void
}

export class AudioPlayer<
	TProvider extends (...args: any[]) => AudioRequest | Promise<AudioRequest>,
> {
	#audioContext = new AudioContext()
	#audioCache = new Map<string, Promise<AudioBuffer>>()
	#getAudio: TProvider
	#activeSpeeches = new Set<AbortController>()

	constructor(getAudio: TProvider) {
		this.#getAudio = getAudio
	}

	getCachedAudio(
		key: string,
		audio: Blob | AudioBuffer | Promise<Blob | AudioBuffer>,
	): Promise<AudioBuffer> {
		let cached = this.#audioCache.get(key)

		if (!cached) {
			cached = Promise.resolve(audio).then((value) =>
				value instanceof AudioBuffer
					? value
					: value
							.arrayBuffer()
							.then((buffer) => this.#audioContext.decodeAudioData(buffer)),
			)

			this.#audioCache.set(key, cached)
			cached.catch(() => this.#audioCache.delete(key))
		}

		return cached
	}

	play(
		args: Parameters<TProvider>,
		{reverb, reverbLevel = 0, volume = 1}: AudioPlayerOptions = {},
	): AudioPlayback {
		const controller = new AbortController()
		this.#activeSpeeches.add(controller)

		const playPromise = this.#play(args, controller.signal, {
			reverb,
			reverbLevel,
			volume,
		}).finally(() => {
			this.#activeSpeeches.delete(controller)
		})

		return {
			playPromise,
			cancel: () => controller.abort(),
		}
	}

	cancelAllSpeeches(): void {
		for (const controller of this.#activeSpeeches) {
			controller.abort()
		}
	}

	async #play(
		args: Parameters<TProvider>,
		signal: AbortSignal,
		{reverb, reverbLevel = 0, volume = 1}: AudioPlayerOptions,
	): Promise<void> {
		const abortError = () => new DOMException('Playback aborted', 'AbortError')
		let source: AudioBufferSourceNode | undefined

		const abortPromise = new Promise<never>((_, reject) => {
			signal.addEventListener(
				'abort',
				() => {
					try {
						source?.stop()
					} catch {
						// The source may already have stopped.
					}

					reject(abortError())
				},
				{once: true},
			)
		})

		const playPromise = (async () => {
			const {key, audio: promise} = await this.#getAudio(...args)
			const audioBuffer = await this.getCachedAudio(key, promise)

			if (signal.aborted) throw abortError()

			if (this.#audioContext.state === 'suspended') {
				await this.#audioContext.resume()
			}

			if (signal.aborted) throw abortError()

			source = this.#audioContext.createBufferSource()
			source.buffer = audioBuffer

			let output: AudioNode = this.#audioContext.destination

			if (volume !== 1) {
				const gain = this.#audioContext.createGain()
				gain.gain.value = volume
				gain.connect(output)
				output = gain
			}

			if (reverb && reverbLevel > 0) {
				const {connectReverb} = await import('./reverb.js')

				if (signal.aborted) throw abortError()

				await connectReverb(
					this.#audioContext,
					source,
					output,
					reverb,
					reverbLevel,
				)
			} else {
				source.connect(output)
			}

			await new Promise<void>((resolve, reject) => {
				const cleanup = () => {
					source?.removeEventListener('ended', onEnded)
					signal.removeEventListener('abort', onAbort)
				}

				const onEnded = () => {
					cleanup()
					resolve()
				}

				const onAbort = () => {
					cleanup()

					try {
						source?.stop()
					} catch {
						// The source may already have stopped.
					}

					reject(abortError())
				}

				source!.addEventListener('ended', onEnded, {once: true})
				signal.addEventListener('abort', onAbort, {once: true})

				if (signal.aborted) {
					onAbort()
					return
				}

				source!.start()
			})
		})()

		return Promise.race([playPromise, abortPromise])
	}
}
