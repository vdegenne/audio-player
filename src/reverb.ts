export const reverbPresets = [
	'Block Inside',
	'Bottle Hall',
	'Cement Blocks 1',
	'Cement Blocks 2',
	'Chateau de Logne, Outside',
	'Conic Long Echo Hall',
	'Deep Space',
	'Derlon Sanctuary',
	'Direct Cabinet N1',
	'Direct Cabinet N2',
	'Direct Cabinet N3',
	'Direct Cabinet N4',
	'Five Columns Long',
	'Five Columns',
	'French 18th Century Salon',
	'Going Home',
	'Greek 7 Echo Hall',
	'Highly Damped Large Room',
	'In The Silo Revised',
	'In The Silo',
	'Large Bottle Hall',
	'Large Long Echo Hall',
	'Large Wide Echo Hall',
	'Masonic Lodge',
	'Musikvereinsaal',
	'Narrow Bumpy Space',
	'Nice Drum Room',
	'On a Star',
	'Parking Garage',
	'Rays',
	'Right Glass Triangle',
	'Ruby Room',
	'Scala Milan Opera Hall',
	'Small Drum Room',
	'Small Prehistoric Cave',
	'St Nicolaes Church',
	'Trig Room',
	'Vocal Duo',
] as const

export type ReverbPreset = (typeof reverbPresets)[number]

const convolverCache = new Map<ReverbPreset, Promise<AudioBuffer>>()

function getConvolverBuffer(
	audioContext: AudioContext,
	reverb: ReverbPreset,
): Promise<AudioBuffer> {
	let promise = convolverCache.get(reverb)

	if (!promise) {
		promise = fetch(`/reverbs/${reverb}.wav`)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`Failed to load reverb preset: ${reverb}`)
				}

				return response.arrayBuffer()
			})
			.then((buffer) => audioContext.decodeAudioData(buffer))

		convolverCache.set(reverb, promise)
		promise.catch(() => convolverCache.delete(reverb))
	}

	return promise
}

export async function connectReverb(
	audioContext: AudioContext,
	source: AudioNode,
	output: AudioNode,
	reverb: ReverbPreset,
	reverbLevel: number,
): Promise<void> {
	const impulseBuffer = await getConvolverBuffer(audioContext, reverb)

	source.connect(output)

	const convolver = audioContext.createConvolver()
	convolver.buffer = impulseBuffer

	const wetGain = audioContext.createGain()
	wetGain.gain.value = reverbLevel

	source.connect(convolver)
	convolver.connect(wetGain)
	wetGain.connect(output)
}
