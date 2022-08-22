/**
 * Copyright 2018 Novage LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SegmentManager } from "./segment-manager";
import type { LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js/src/types/loader";

const DEFAULT_DOWNLOAD_LATENCY = 1;
const DEFAULT_DOWNLOAD_BANDWIDTH = 12500; // bytes per millisecond

export class HlsJsLoader {
    private segmentManager: SegmentManager;

    public constructor(segmentManager: SegmentManager) {
        this.segmentManager = segmentManager;
    }


    public async load(
        context: LoaderContext,
        _config: LoaderConfiguration,
        callbacks: LoaderCallbacks<LoaderContext>,
    ): Promise<void> {
        if (((context as unknown) as { type: unknown }).type) {
            console.log("LOAD PLAYLIST")
            try {
                const result = await this.segmentManager.loadPlaylist(context.url);
                this.successPlaylist(result, context, callbacks);
            } catch (e) {
                let e_s = e as {code: number, text: string}
                this.error(e_s, context, callbacks);
            }
        } else if (((context as unknown) as { frag: unknown }).frag) {
            console.log("LOAD SEGMENT" + context.url)
            try {
                const result = await this.segmentManager.loadSegment(
                    context.url,
                    context.rangeStart === undefined || context.rangeEnd === undefined
                        ? undefined
                        : { offset: context.rangeStart, length: context.rangeEnd - context.rangeStart }
                );
                const { content } = result;
                console.log("content: " + content);
                if (content !== undefined) {
                    setTimeout(() => this.successSegment(content, result.downloadBandwidth, context, callbacks), 0);
                }
            } catch (e) {
                let e_s = e as {code: number, text: string}
                console.log("ERROR: ", JSON.stringify(e))
                setTimeout(() => this.error(e_s, context, callbacks), 0);
            }
        } else {
            console.warn("Unknown load request", context);
        }
    }

    public abort(context: LoaderContext): void {
        this.segmentManager.abortSegment(
            context.url,
            context.rangeStart === undefined || context.rangeEnd === undefined
                ? undefined
                : { offset: context.rangeStart, length: context.rangeEnd - context.rangeStart }
        );
    }

    private successPlaylist(
        xhr: { response: string; responseURL: string },
        context: LoaderContext,
        callbacks: LoaderCallbacks<LoaderContext>
    ): void {
        const now = performance.now();

        const stats = {
            trequest: now - 300,
            tfirst: now - 200,
            tload: now - 1,
            tparsed: now,
            loaded: xhr.response.length,
            total: xhr.response.length,
        };

        console.log("RESPONSE URL: " + xhr.responseURL)
        console.log("XHR RESPONSE: " + xhr.response)

        callbacks.onSuccess(
            {
                url: xhr.responseURL,
                data: xhr.response,
            },
            stats,
            context,
            undefined
        );
    }

    private successSegment(
        content: ArrayBuffer,
        downloadBandwidth: number | undefined,
        context: LoaderContext,
        callbacks: LoaderCallbacks<LoaderContext>
    ): void {

        console.log("CONTENT SIZE: ", content.byteLength)
        const now = performance.now();
        const downloadTime =
            content.byteLength /
            (downloadBandwidth === undefined || downloadBandwidth <= 0
                ? DEFAULT_DOWNLOAD_BANDWIDTH
                : downloadBandwidth);

        const stats = {
            trequest: now - DEFAULT_DOWNLOAD_LATENCY - downloadTime,
            tfirst: now - downloadTime,
            tload: now - 1,
            tparsed: now,
            loaded: content.byteLength,
            total: content.byteLength,
        };

        // const split_arr = context.url.split("/")
        // const url = split_arr[split_arr.length - 1];
        // console.log("context URL: " + url)

        callbacks.onSuccess(
            {
                url: context.url,
                data: content,
            },
            stats,
            context,
            undefined
        );

        console.log("AFTER ON SUCCESS");
    }

    private error(
        error: { code: number; text: string },
        context: LoaderContext,
        callbacks: LoaderCallbacks<LoaderContext>
    ): void {
        callbacks.onError(error, context, undefined);
    }
}
