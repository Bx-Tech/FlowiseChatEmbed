import { TypingBubble } from '@/components';
import { Show } from 'solid-js';
import { Avatar } from '../avatars/Avatar';

type LoadingBubbleProps = {
  showAvatar?: boolean;
  avatarSrc?: string;
};

export const LoadingBubble = (props: LoadingBubbleProps) => (
  <div class="flex justify-start mb-2 items-center animate-fade-in host-container">
    <Show when={props.showAvatar}>
      <Avatar initialAvatarSrc={props.avatarSrc} />
    </Show>
    <span class="px-4 py-4 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble" data-testid="host-bubble">
      <TypingBubble />
    </span>
  </div>
);
