/**
 * Hero (and similar) list-item group visibility. Flags live on the slide; omitted/`true` = show,
 * `false` = hide without deleting title/description/media/actions content.
 */

export type GroupVisibility = {
  showSubtitle?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showMedia?: boolean;
  showActions?: boolean;
};

export function slideGroups(sl: GroupVisibility) {
  return {
    subtitle: sl.showSubtitle !== false,
    title: sl.showTitle !== false,
    description: sl.showDescription !== false,
    media: sl.showMedia !== false,
    actions: sl.showActions !== false,
  };
}
