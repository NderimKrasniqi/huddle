export {
  lifecycleFailureMessage,
  rejectionMessage,
  type PhoneGameRejection,
} from '../../models';

/**
 * What the Host's phone says when starting or ending a game does not happen.
 *
 * Built exactly like `host-control-rejection.ts` and `join-rejection.ts`: the failure
 * is told apart by `kind` off `ConvexError.data`, never by matching a message
 * somebody may reword.
 */

/** When the failure is not one of the server's answers, but the trip itself. */
