import type { ReactNode } from "react"
import type { EnrichedTweet, Entity } from "react-tweet"

const renderEntityToReactNode = (item: Entity, key: string | number): ReactNode => {
  switch (item.type) {
    case "hashtag":
    case "mention":
    case "url":
    case "symbol":
      return (
        <a
          key={key}
          className="text-[rgb(29,161,242)] font-normal no-underline hover:underline"
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.text}
        </a>
      )
    case "media":
      return null // Media entities are not rendered as text
    default:
      // Using span for key prop, dangerouslySetInnerHTML for text
      return <span key={key} dangerouslySetInnerHTML={{ __html: item.text }} />
  }
}

export const TruncatedTweetText = ({ tweet, wordLimit }: { tweet: EnrichedTweet; wordLimit: number }) => {
  let currentWordCount = 0
  const outputNodes: ReactNode[] = []
  let textFullyRendered = true

  for (let i = 0; i < tweet.entities.length; i++) {
    const item = tweet.entities[i]
    if (item.type === "media") continue

    const itemText = item.text
    const itemWords = itemText.split(/\s+/).filter(Boolean)
    const wordsInItem = itemWords.length

    if (currentWordCount + wordsInItem <= wordLimit) {
      outputNodes.push(renderEntityToReactNode(item, `entity-${i}`))
      currentWordCount += wordsInItem
    } else {
      const remainingWordsAllowed = wordLimit - currentWordCount
      if (remainingWordsAllowed > 0) {
        const partialText = itemWords.slice(0, remainingWordsAllowed).join(" ")
        // Create a new entity-like object for the partial text, ensuring it ends with an ellipsis
        const displayText =
          partialText + (itemWords.length > remainingWordsAllowed || i < tweet.entities.length - 1 ? "..." : "")
        const partialItem: Entity = { ...item, text: displayText }
        outputNodes.push(renderEntityToReactNode(partialItem, `entity-${i}-partial`))
        currentWordCount += remainingWordsAllowed
      } else if (outputNodes.length > 0 && !textFullyRendered) {
        // If no words are allowed from the current item, but the text is already truncated,
        // ensure the last node has an ellipsis if it doesn't already.
        // This is complex, the current ellipsis logic on partialItem should mostly cover it.
      }
      textFullyRendered = false
      break
    }
  }

  return <div className="mb-2 mt-4 whitespace-pre-wrap text-sm text-gray-700">{outputNodes}</div>
}
