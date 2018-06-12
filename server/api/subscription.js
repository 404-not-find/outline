// @flow
import Router from 'koa-router';
import auth from '../middlewares/authentication';
import { InvalidRequestError } from '../errors';
import policy from '../policies';
import * as Stripe from '../stripe';
import { BILLING_ENABLED } from '../../shared/environment';

const { authorize } = policy;
const router = new Router();

/**
 * Subscription middleware
 *
 * - Only limit to hosted installations
 * - Creates Stripe customers for teams
 */

function subscriptionMiddleware() {
  return async function subscriptionMiddleware(ctx: Object, next: Function) {
    const user = ctx.state.user;
    const team = await user.getTeam();
    if (!BILLING_ENABLED)
      throw new InvalidRequestError('Endpoint not available');
    if (!team.stripeCustomerId) await Stripe.linkToStripe({ user, team });
    return next();
  };
}

router.use(auth());
router.use(subscriptionMiddleware());

/**
 * Customer facing endpoints
 */

router.post('subscription.create', async ctx => {
  const { plan, stripeToken, coupon } = ctx.body;
  ctx.assertPresent(plan, 'plan is required');
  ctx.assertValueInArray(
    plan,
    ['subscription-yearly', 'subscription-monthly', 'free'],
    'valid plan is required'
  );
  ctx.assertPresent(stripeToken, 'stripeToken is required');

  const user = ctx.state.user;
  const team = await user.getTeam();
  authorize(user, 'createPlanSubscription', team);

  try {
    const subscriptionResponse = await Stripe.createSubscription({
      user,
      team,
      plan,
      stripeToken,
      coupon,
    });
    ctx.body = {
      data: subscriptionResponse,
    };
  } catch (err) {
    throw new InvalidRequestError(err.message);
  }
});

router.post('subscription.status', async ctx => {
  const user = ctx.state.user;
  const team = await user.getTeam();
  authorize(user, 'readPlanSubscription', team);

  try {
    const subscriptionResponse = await Stripe.subscriptionStatus({
      team,
    });
    ctx.body = {
      data: subscriptionResponse,
    };
  } catch (err) {
    throw new InvalidRequestError(err.message);
  }
});

router.post('subscription.cancel', async ctx => {
  const user = ctx.state.user;
  const team = await user.getTeam();
  authorize(user, 'cancelPlanSubscription', team);

  try {
    const subscriptionResponse = await Stripe.cancelSubscription({
      team,
    });
    ctx.body = {
      data: subscriptionResponse,
    };
  } catch (err) {
    throw new InvalidRequestError(err.message);
  }
});

router.post('subscription.update', async ctx => {
  const { stripeToken } = ctx.body;
  ctx.assertPresent(stripeToken, 'stripeToken is required');

  const user = ctx.state.user;
  const team = await user.getTeam();
  authorize(user, 'updatePlanSubscription', team);

  try {
    const subscriptionResponse = await Stripe.updateSubscription({
      team,
      stripeToken,
    });
    ctx.body = {
      data: subscriptionResponse,
    };
  } catch (err) {
    throw new InvalidRequestError(err.message);
  }
});

export default router;