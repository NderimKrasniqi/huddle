/** TASK-04 spike: where a TV advertising a room code was found. */
export type FoundTv = {
  /** IPv4 addresses the TV published, in its order; try each until one answers. */
  readonly hosts: readonly string[];
  readonly port: number;
  readonly name: string;
};
