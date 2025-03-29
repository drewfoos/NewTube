import Link from "next/link";
import { VideoGetOneOutput } from "../../types";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { SubscriptionButton } from "@/modules/subscriptions/ui/components/subscription-button";

interface VideoOwnerProps {
    user: VideoGetOneOutput["user"];
    videoId: string;
}

export const VideoOwner = ({ user, videoId }: VideoOwnerProps) => {
    const { userId: clerkUserId } = useAuth();

    return (
        <div className="flex items-center sm:items-start justify-between sm:justify-start gap-3 min-w-0">
            <Link href={`/users/${user.id}`}>
                <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar size="lg" imageUrl={user.imageUrl} name={user.name} />
                    <span className="text-sm text-muted-foreground line-clamp-1">
                        {/* TODO: Properly fill subscriber count */}
                        {0} subscribers
                    </span>
                </div>
            </Link>
            {clerkUserId === user.clerkId ? (
                <Button
                    variant="secondary"
                    className="rounded-full"
                    asChild
                >
                    <Link href={`/studio/videos/${videoId}`}>
                        Edit video
                    </Link>
                </Button>
            ) : (
                <SubscriptionButton 
                    onClick={() => {}}
                    disabled={false}
                    isSubscribed={false}
                    className="flex-none"
                />
            )}
        </div>
    )
}