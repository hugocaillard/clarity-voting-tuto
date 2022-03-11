(define-data-var nb-of-voters uint u0)
(define-map votes principal bool)

(define-public (vote)
  (begin
    (asserts! (is-none (map-get? votes tx-sender)) (err u403))

    (map-insert votes tx-sender true)
    (ok (var-set nb-of-voters (+ (var-get nb-of-voters) u1)))
  )
)

(define-read-only (get-nb-of-voters) (var-get nb-of-voters))
