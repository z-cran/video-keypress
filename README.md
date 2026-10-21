# Video Keypress

## About

React app to record events via keypresses while watching a video.

## Link to App

GitHub Pages: https://zacran.github.io/video-keypress/

## Supported Video File Types

The following video file types are supported ([source](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Video_codecs)).

| Codec name (short) | Full codec name               | Container support    |
| ------------------ | ----------------------------- | -------------------- |
| AV1                | AOMedia Video 1               | MP4, WebM            |
| AVC (H.264)        | Advanced Video Coding         | 3GP, MP4             |
| H.263              | H.263 Video                   | 3GP                  |
| HEVC (H.265)       | High Efficiency Video Coding  | MP4                  |
| MP4V-ES            | MPEG-4 Video Elemental Stream | 3GP, MP4             |
| MPEG-1             | MPEG-1 Part 2 Visual          | MPEG, QuickTime      |
| MPEG-2             | MPEG-2 Part 2 Visual          | MP4, MPEG, QuickTime |
| Theora             | Theora                        | Ogg                  |
| VP8                | Video Processor 8             | 3GP, Ogg, WebM       |
| VP9                | Video Processor 9             | MP4, Ogg, WebM       |

## Data Structure

Events recorded in this app will be collated into a array of events with the following JSON structure:

```yaml
[
  {
    "id": 0, # unique ordinal id for the event;
    "key": "key", # key pressed
    "behavior": "Behavior", # behavior name
    "start": 0.0, # start time of event (in seconds)
    "end": 4.037488, # end time of event (in seconds)
    "order": 1 # ordinal position of the behavior within the generated chart; starts at 1
  }
]
```
