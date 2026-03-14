import type { MediaDetails } from 'react-tweet/api'
import { type EnrichedTweet, getMediaUrl, getMp4Video } from 'react-tweet'
import BlurImage from './blur-image'

export const TweetMedia = ({
  tweet,
  media,
}: {
  tweet: EnrichedTweet
  media: MediaDetails
}) => {
  if (media.type == 'video') {
    return (
      <div className="relative">
        <BlurImage
          alt={tweet.text}
          width={2048}
          height={media.original_info.height * (2048 / media.original_info.width)}
          src={getMediaUrl(media, 'small')}
          className="rounded-lg border border-gray-200 drop-shadow-sm"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-full p-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  if (media.type == 'animated_gif') {
    return (
      <BlurImage
        alt={tweet.text}
        width={2048}
        height={media.original_info.height * (2048 / media.original_info.width)}
        src={getMp4Video(media).url}
        className="rounded-lg border border-gray-200 drop-shadow-sm"
      />
    )
  }

  return (
    <BlurImage
      alt={tweet.text}
      width={2048}
      height={media.original_info.height * (2048 / media.original_info.width)}
      src={getMediaUrl(media, 'small')}
      className="rounded-lg border border-gray-200 drop-shadow-sm"
    />
  )
}
