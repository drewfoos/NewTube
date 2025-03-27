import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import {
    VideoAssetCreatedWebhookEvent,
    VideoAssetErroredWebhookEvent,
    VideoAssetReadyWebhookEvent,
    VideoAssetTrackReadyWebhookEvent,
    VideoAssetDeletedWebhookEvent,
} from "@mux/mux-node/resources/webhooks"
import { mux } from "@/lib/mux";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { UTApi } from "uploadthing/server";

const SIGNING_SECRET = process.env.MUX_WEBHOOK_SECRET!;

type WebhookEvent =
    | VideoAssetCreatedWebhookEvent
    | VideoAssetErroredWebhookEvent
    | VideoAssetReadyWebhookEvent
    | VideoAssetTrackReadyWebhookEvent
    | VideoAssetDeletedWebhookEvent

export const POST = async (request: Request) => {
    // Global error handling
    try {
        if (!SIGNING_SECRET) {
            console.error("MUX_WEBHOOK_SECRET environment variable is not set");
            return new Response("Server configuration error", { status: 500 });
        }

        // Get and validate headers
        const headersPayload = await headers();
        const muxSignature = headersPayload.get("mux-signature");

        if (!muxSignature) {
            console.warn("Webhook received without mux-signature header");
            return new Response("No signature found", { status: 401 });
        }

        // Parse and verify payload
        let payload;
        let body;
        
        try {
            payload = await request.json();
            body = JSON.stringify(payload);
        } catch (error) {
            console.error("Failed to parse webhook payload:", error);
            return new Response("Invalid JSON payload", { status: 400 });
        }

        // Verify the webhook signature
        try {
            mux.webhooks.verifySignature(
                body,
                { "mux-signature": muxSignature },
                SIGNING_SECRET
            );
        } catch (error) {
            console.error("Mux signature verification failed:", error);
            return new Response("Invalid signature", { status: 401 });
        }

        // Basic validation of webhook type
        const eventType = payload.type as string;
        if (!eventType) {
            console.error("Webhook missing event type:", payload);
            return new Response("Missing event type", { status: 400 });
        }

        // Process different webhook event types
        switch (eventType as WebhookEvent["type"]) {
            case "video.asset.created": {
                try {
                    const data = payload.data as VideoAssetCreatedWebhookEvent["data"];

                    if (!data.upload_id) {
                        console.error("video.asset.created webhook missing upload_id:", data);
                        return new Response("No upload ID found", { status: 400 });
                    }

                    // Check if the video record exists before updating
                    const [existingVideo] = await db
                        .select({ id: videos.id })
                        .from(videos)
                        .where(eq(videos.muxUploadId, data.upload_id))
                        .limit(1);

                    if (!existingVideo) {
                        console.warn(`No video found with muxUploadId: ${data.upload_id}`);
                        return new Response("Video not found", { status: 404 });
                    }

                    await db
                        .update(videos)
                        .set({
                            muxAssetId: data.id,
                            muxStatus: data.status,
                            updatedAt: new Date(), // Ensure updatedAt is refreshed
                        })
                        .where(eq(videos.muxUploadId, data.upload_id));

                } catch (error) {
                    console.error("Error processing video.asset.created webhook:", error);
                    return new Response("Internal server error", { status: 500 });
                }
                break;
            }

            case "video.asset.ready": {
                try {
                    const data = payload.data as VideoAssetReadyWebhookEvent["data"];
                    
                    if (!data.upload_id) {
                        console.error("video.asset.ready webhook missing upload_id:", data);
                        return new Response("Missing upload ID", { status: 400 });
                    }

                    const playbackId = data.playback_ids?.[0]?.id;
                    if (!playbackId) {
                        console.error("video.asset.ready webhook missing playback_id:", data);
                        return new Response("Missing playback ID", { status: 400 });
                    }

                    // Check if the video record exists before updating
                    const [existingVideo] = await db
                        .select({ id: videos.id })
                        .from(videos)
                        .where(eq(videos.muxUploadId, data.upload_id))
                        .limit(1);

                    if (!existingVideo) {
                        console.warn(`No video found with muxUploadId: ${data.upload_id}`);
                        return new Response("Video not found", { status: 404 });
                    }

                    const tempThumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
                    const tempPreviewUrl = `https://image.mux.com/${playbackId}/animated.gif`;
                    const duration = data.duration ? Math.round(data.duration * 1000) : 0;

                    const utapi = new UTApi();
                    
                    // Add individual error handling for each upload
                    let thumbnailKey, thumbnailUrl, previewKey, previewUrl;
                    
                    try {
                        const uploadedThumbnail = await utapi.uploadFilesFromUrl(tempThumbnailUrl);
                        if (!uploadedThumbnail.data) {
                            console.error("Failed to upload thumbnail from Mux:", tempThumbnailUrl);
                            throw new Error("Thumbnail upload failed");
                        }
                        thumbnailKey = uploadedThumbnail.data.key;
                        thumbnailUrl = uploadedThumbnail.data.url;
                    } catch (thumbnailError) {
                        console.error("Error uploading thumbnail:", thumbnailError);
                        // Continue with the process even if thumbnail fails
                    }

                    try {
                        const uploadedPreview = await utapi.uploadFilesFromUrl(tempPreviewUrl);
                        if (!uploadedPreview.data) {
                            console.error("Failed to upload preview from Mux:", tempPreviewUrl);
                            throw new Error("Preview upload failed");
                        }
                        previewKey = uploadedPreview.data.key;
                        previewUrl = uploadedPreview.data.url;
                    } catch (previewError) {
                        console.error("Error uploading preview:", previewError);
                        // Continue with the process even if preview fails
                    }

                    // Only update with the assets we successfully got
                    const updateData: Record<string, any> = {
                        muxStatus: data.status,
                        muxPlaybackId: playbackId,
                        muxAssetId: data.id,
                        duration,
                        updatedAt: new Date(),
                    };

                    if (thumbnailUrl && thumbnailKey) {
                        updateData.thumbnailUrl = thumbnailUrl;
                        updateData.thumbnailKey = thumbnailKey;
                    }

                    if (previewUrl && previewKey) {
                        updateData.previewUrl = previewUrl;
                        updateData.previewKey = previewKey;
                    }

                    await db
                        .update(videos)
                        .set(updateData)
                        .where(eq(videos.muxUploadId, data.upload_id));

                } catch (error) {
                    console.error("Error processing video.asset.ready webhook:", error);
                    return new Response("Internal server error", { status: 500 });
                }
                break;
            }

            case "video.asset.errored": {
                try {
                    const data = payload.data as VideoAssetErroredWebhookEvent["data"];

                    if (!data.upload_id) {
                        console.error("video.asset.errored webhook missing upload_id:", data);
                        return new Response("Missing upload ID", { status: 400 });
                    }

                    // Check if the video exists
                    const [existingVideo] = await db
                        .select({ id: videos.id })
                        .from(videos)
                        .where(eq(videos.muxUploadId, data.upload_id))
                        .limit(1);

                    if (!existingVideo) {
                        console.warn(`No video found with muxUploadId: ${data.upload_id}`);
                        return new Response("Video not found", { status: 404 });
                    }

                    await db
                        .update(videos)
                        .set({
                            muxStatus: data.status,
                            updatedAt: new Date(),
                        })
                        .where(eq(videos.muxUploadId, data.upload_id));
                } catch (error) {
                    console.error("Error processing video.asset.errored webhook:", error);
                    return new Response("Internal server error", { status: 500 });
                }
                break;
            }

            case "video.asset.deleted": {
                try {
                    const data = payload.data as VideoAssetDeletedWebhookEvent["data"];
                
                    if (!data.upload_id) {
                        console.error("video.asset.deleted webhook missing upload_id:", data);
                        return new Response("Missing upload ID", { status: 400 });
                    }
                
                    // Find the video to get the Uploadthing keys
                    const [videoToDelete] = await db
                        .select()
                        .from(videos)
                        .where(eq(videos.muxUploadId, data.upload_id))
                        .limit(1);
                
                    if (videoToDelete) {
                        // Clean up Uploadthing assets
                        const utapi = new UTApi();
                        
                        // Delete thumbnail if it exists
                        if (videoToDelete.thumbnailKey) {
                            try {
                                await utapi.deleteFiles(videoToDelete.thumbnailKey);
                            } catch (thumbnailError) {
                                console.error("Error deleting thumbnail:", thumbnailError);
                                // Continue with deletion even if this fails
                            }
                        }
                        
                        // Delete animated GIF preview if it exists
                        if (videoToDelete.previewKey) {
                            try {
                                await utapi.deleteFiles(videoToDelete.previewKey);
                            } catch (previewError) {
                                console.error("Error deleting preview:", previewError);
                                // Continue with deletion even if this fails
                            }
                        }
                        
                        // Delete the database record
                        await db
                            .delete(videos)
                            .where(eq(videos.id, videoToDelete.id));
            
                    } else {
                        console.warn(`No video found with muxUploadId: ${data.upload_id}`);
                        // Still try to delete any record with that upload ID as a fallback
                        await db
                            .delete(videos)
                            .where(eq(videos.muxUploadId, data.upload_id));
                    }
                } catch (error) {
                    console.error("Error in video.asset.deleted webhook handler:", error);
                    // Still return 200 to acknowledge the webhook
                }
                break;
            }

            case "video.asset.track.ready": {
                try {
                    // Handle the type issue with a proper cast that includes asset_id
                    const data = payload.data as unknown as VideoAssetTrackReadyWebhookEvent["data"] & {
                        asset_id: string;
                    };

                    // Additional validation for asset_id
                    const assetId = data.asset_id;
                    if (!assetId) {
                        console.error("video.asset.track.ready webhook missing asset_id:", data);
                        return new Response("Missing asset ID", { status: 400 });
                    }

                    const trackId = data.id;
                    const status = data.status;

                    // Check if video exists with this asset ID
                    const [existingVideo] = await db
                        .select({ id: videos.id })
                        .from(videos)
                        .where(eq(videos.muxAssetId, assetId))
                        .limit(1);

                    if (!existingVideo) {
                        console.warn(`No video found with muxAssetId: ${assetId}`);
                        return new Response("Video not found", { status: 404 });
                    }

                    await db
                        .update(videos)
                        .set({
                            muxTrackId: trackId,
                            muxTrackStatus: status,
                            updatedAt: new Date(),
                        })
                        .where(eq(videos.muxAssetId, assetId));
                } catch (error) {
                    console.error("Error processing video.asset.track.ready webhook:", error);
                    return new Response("Internal server error", { status: 500 });
                }
                break;
            }

            default: {
                console.warn(`Unhandled webhook event type: ${eventType}`);
                // Still return 200 to acknowledge receipt
            }
        }

        return new Response("Webhook processed successfully", { status: 200 });
    } catch (error) {
        // Global error handler - catch any uncaught exceptions
        console.error("Unhandled error in Mux webhook handler:", error);
        return new Response("Internal server error", { status: 500 });
    }
};