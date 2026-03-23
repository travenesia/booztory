# Toast & Button State Text

Reference for all toast notifications and dynamic button labels across the app.
Edit here to plan copy changes, then apply them in the relevant files.

---

## Toasts

### `components/modals/submitContent.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| Empty text | "Empty Text" | "Please write something before submitting." | destructive |
| Not authenticated | "Authentication Required" | "You must be signed in to submit content." | destructive |
| Invalid URL | "Invalid Input" | "Please enter a valid URL before submitting." | destructive |
| Payment cancelled | "Payment Cancelled" | "Content submission was cancelled." | — |
| URL submitted | "Content Submitted!" | "Your content has been scheduled and will appear shortly." | — |
| Text submitted | "Content Submitted!" | "Your text has been scheduled and will appear shortly." | — |
| Failed | "Submission Failed" | error message or "Failed to submit content. Please try again." | destructive |

### `components/modals/donationModal.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| Invalid amount | "Invalid Amount" | "Please enter a valid donation amount." | destructive |
| Not authenticated | "Authentication Required" | "You must be signed in to make a donation." | destructive |
| Successful | "Donation Successful!" | "Thank you for donating $${amount} USDC to @${creator}!" | — |
| Cancelled | "Donation Cancelled" | "Your donation was cancelled." | — |
| Failed | "Donation Failed" | error message or "Failed to process donation. Please try again." | destructive |

### `hooks/usePayment.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| Minted | "Slot Minted!" | "Your content has been scheduled." | — |
| Failed | "Transaction Failed" | error message | destructive |

### `components/wallet/connectWallet.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| Rejected | "Signature Rejected" | "Please sign the message to continue." | destructive |
| Failed | "Sign-in Failed" | error message | destructive |

### `app/page.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| No wallet | "Connect Wallet First" | "You need to connect your wallet to submit content." | destructive |

### `app/reward/page.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| Raffle entered | "Entered Raffle!" | "${amount} ticket(s) used for Raffle #${n}." | — |
| Entry failed | "Failed" | "Transaction failed." | destructive |
| Draw triggered | "Draw Triggered!" | "VRF request submitted for Raffle #${n}." | — |
| Draw failed | "Draw Failed" | error message | destructive |
| Draw reset | "Draw Reset" | "Raffle #${n} ready to re-trigger." | — |
| Raffle cancelled | "Raffle Cancelled" | "Raffle #${n} has been cancelled." | — |
| Points converted | "Converted!" | "${amount} ticket(s) added to your balance." | — |

### `app/sponsor/page.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| Applied | "Application submitted!" | "We'll review it within 24–48 hours." | — |
| Apply failed | "Failed" | error message | destructive |
| Refunded | "Refunded" | "Payment returned to your wallet." | — |
| Refund failed | "Failed" | error message | destructive |

### `app/admin/sponsors/page.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| Accepted | "Accepted" | "Application #${id} updated." | — |
| Rejected | "Rejected" | "Application #${id} updated." | — |
| Action failed | "Failed" | "Transaction failed." | destructive |
| Tier set | "Price Tier Set" | "${hours}h — $${prize} prize + $${fee} fee" | — |
| Tier removed | "Tier Removed" | — | — |

### `app/admin/raffle/page.tsx`
| State | Title | Description | Variant |
|---|---|---|---|
| Default threshold set | "Updated" | "Default threshold set to ${val}." | — |
| Min entrants set | "Updated" | "Min unique entrants set to ${val}." | — |
| Raffle thresholds set | "Updated" | "Raffle #${n} thresholds updated." | — |
| USDC withdrawn | "Withdrawn" | "USDC withdrawn to owner wallet." | — |
| Raffle created | "Raffle Created!" | "${n} winner(s) · $X USDC / X BOOZ" | — |
| Any failure | "Failed" | "Transaction failed." | destructive |

---

## Button States

### `components/modals/submitContent.tsx`
| Condition | Label |
|---|---|
| No wallet | "Connect Wallet to Submit" |
| Queue full, known time | "Queue Full — opens in ${time}" |
| Queue full, unknown | "Queue Full — Check Back Later" |
| Standard path | "Pay ${price} USDC to Submit" |
| Discount path | "Pay ${price} USDC + Burn ${burn} $BOOZ" |
| Free/burn path | "Burn ${cost} $BOOZ to Submit" |
| Processing payment | "Processing Payment..." |
| Submitting | "Submitting..." |
| Generic processing | "Processing..." |

### `components/modals/donationModal.tsx`
| Condition | Label |
|---|---|
| Default | "Donate ${amount} USDC" |
| Processing | "Processing..." |

### `components/modals/gmModal.tsx`
| Condition | Label |
|---|---|
| Default | "CLAIM" |
| Awaiting wallet | "Confirm in wallet..." |
| Confirming tx | "Claiming..." |
| Already claimed | "Already Claimed" (disabled) |
| Not connected | "Connect Wallet First" (disabled) |
| Journey complete | "Journey Complete 🔱" (disabled) |

### `app/reward/page.tsx`
| Condition | Label |
|---|---|
| First entry | "Enter" |
| Already entered | "Add More" |
| Entering | "Entering..." |
| Convert default | "Convert" |
| Converting | "Converting..." |

### `app/sponsor/page.tsx`
| Condition | Label |
|---|---|
| Default | "Apply — $${cost} USDC" |
| Submitting | "Submitting…" |

### `app/admin/raffle/page.tsx`
| Condition | Label |
|---|---|
| Default | "Withdraw USDC to Owner" |
| Withdrawing | "Withdrawing..." |
