"use strict";
var Lambert;
(function (Lambert) {
    function solve(r1vec, r2vec, tof, attractor) {
        const mu = attractor.stdGravParam;
        const r1 = mag3(r1vec);
        const r2 = mag3(r2vec);
        const c = mag3(sub3(r2vec, r1vec));
        const s = 0.5 * (r1 + r2 + c);
        const ir1 = div3(r1vec, r1);
        const ir2 = div3(r2vec, r2);
        const ih = normalize3(cross(ir1, ir2));
        const lambda2 = 1 - c / s;
        let lambda = Math.sqrt(lambda2);
        let it1, it2;
        if (ih.y < 0) {
            lambda = -lambda;
            it1 = cross(ir1, ih);
            it2 = cross(ir2, ih);
        }
        else {
            it1 = cross(ih, ir1);
            it2 = cross(ih, ir2);
        }
        it1 = normalize3(it1);
        it2 = normalize3(it2);
        const lambda3 = lambda * lambda2;
        const T = Math.sqrt(2 * mu / (s * s * s)) * tof;
        const T0 = Math.acos(lambda) + lambda * Math.sqrt(1 - lambda2);
        const T1 = 2 / 3 * (1 - lambda3);
        let x0;
        if (T >= T0) {
            x0 = -(T - T0) / (T - T0 + 4);
        }
        else if (T <= T1) {
            x0 = T1 * (T1 - T) / (2 / 5 * (1 - lambda2 * lambda3) * T) + 1;
        }
        else {
            x0 = Math.pow(T / T0, 0.69314718055994529 / Math.log(T1 / T0)) - 1;
        }
        const x = householderIterations(T, x0, 1e-15, lambda, 15);
        const gamma = Math.sqrt(mu * s / 2.0);
        const rho = (r1 - r2) / c;
        const sigma = Math.sqrt(1 - rho * rho);
        const y = Math.sqrt(1.0 - lambda2 + lambda2 * x * x);
        const vr1 = gamma * ((lambda * y - x) - rho * (lambda * y + x)) / r1;
        const vr2 = -gamma * ((lambda * y - x) + rho * (lambda * y + x)) / r2;
        const vt = gamma * sigma * (y + lambda * x);
        const vt1 = vt / r1;
        const vt2 = vt / r2;
        const v1 = add3(mult3(ir1, vr1), mult3(it1, vt1));
        const v2 = add3(mult3(ir2, vr2), mult3(it2, vt2));
        return { v1, v2 };
    }
    Lambert.solve = solve;
    function householderIterations(T, x0, eps, lambda, maxIters) {
        let err = 1;
        let xnew = 0;
        let tof = 0;
        let delta = 0;
        let DT = 0, DDT = 0, DDDT = 0;
        for (let it = 0; err > eps && it < maxIters; it++) {
            tof = x2tof(x0, lambda);
            const DTs = dTdx(DT, DDT, DDDT, x0, tof, lambda);
            DT = DTs.DT;
            DDT = DTs.DDT;
            DDDT = DTs.DDDT;
            delta = tof - T;
            const DT2 = DT * DT;
            xnew = x0 - delta * (DT2 - delta * DDT / 2) / (DT * (DT2 - delta * DDT) + DDDT * delta * delta / 6);
            err = Math.abs(x0 - xnew);
            x0 = xnew;
        }
        return x0;
    }
    function dTdx(DT, DDT, DDDT, x, T, lambda) {
        const l2 = lambda * lambda;
        const l3 = l2 * lambda;
        const umx2 = 1.0 - x * x;
        const y = Math.sqrt(1.0 - l2 * umx2);
        const y2 = y * y;
        const y3 = y2 * y;
        DT = 1.0 / umx2 * (3.0 * T * x - 2.0 + 2.0 * l3 * x / y);
        DDT = 1.0 / umx2 * (3.0 * T + 5.0 * x * DT + 2.0 * (1.0 - l2) * l3 / y3);
        DDDT = 1.0 / umx2 * (7.0 * x * DDT + 8.0 * DT - 6.0 * (1.0 - l2) * l2 * l3 * x / y3 / y2);
        return { DT, DDT, DDDT };
    }
    function x2tof2(x, lambda) {
        const a = 1.0 / (1.0 - x * x);
        if (a > 0) {
            let alfa = 2.0 * Math.acos(x);
            let beta = 2.0 * Math.asin(Math.sqrt(lambda * lambda / a));
            if (lambda < 0.0)
                beta = -beta;
            return ((a * Math.sqrt(a) * ((alfa - Math.sin(alfa)) - (beta - Math.sin(beta)))) / 2.0);
        }
        else {
            let alfa = 2.0 * Math.acosh(x);
            let beta = 2.0 * Math.asinh(Math.sqrt(-lambda * lambda / a));
            if (lambda < 0.0)
                beta = -beta;
            return (-a * Math.sqrt(-a) * ((beta - Math.sinh(beta)) - (alfa - Math.sinh(alfa))) / 2.0);
        }
    }
    function x2tof(x, lambda) {
        const battin = 0.01;
        const lagrange = 0.2;
        const dist = Math.abs(x - 1);
        if (dist < lagrange && dist > battin) {
            return x2tof2(x, lambda);
        }
        const K = lambda * lambda;
        const E = x * x - 1.0;
        const rho = Math.abs(E);
        const z = Math.sqrt(1 + K * E);
        if (dist < battin) {
            const eta = z - lambda * x;
            const S1 = 0.5 * (1.0 - lambda - x * eta);
            let Q = hypergeometricF(S1, 1e-11);
            Q = 4.0 / 3.0 * Q;
            return (eta * eta * eta * Q + 4 * lambda * eta) / 2.0;
        }
        else {
            const y = Math.sqrt(rho);
            const g = x * z - lambda * E;
            let d = 0.0;
            if (E < 0) {
                const l = Math.acos(g);
                d = l;
            }
            else {
                const f = y * (z - lambda * x);
                d = Math.log(f + g);
            }
            return (x - lambda * z - d / y) / E;
        }
    }
    function hypergeometricF(z, tol) {
        let Sj = 1.0;
        let Cj = 1.0;
        let err = 1.0;
        let Cj1 = 0.0;
        let Sj1 = 0.0;
        let j = 0;
        while (err > tol) {
            Cj1 = Cj * (3.0 + j) * (1.0 + j) / (2.5 + j) * z / (j + 1);
            Sj1 = Sj + Cj1;
            err = Math.abs(Cj1);
            Sj = Sj1;
            Cj = Cj1;
            j++;
        }
        return Sj;
    }
})(Lambert || (Lambert = {}));
